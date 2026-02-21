-- Outbox Pattern Implementation for Argus
-- 
-- This migration implements the outbox pattern required for CDC:
-- Argus writes events to outbox table, Chronos reads and publishes to Iris
--
-- Reference: system-architecture.md shows:
-- Argus -->|Write Events<br/>Outbox Pattern| Atlas
-- Atlas -->|WAL Stream| Chronos
-- Chronos -->|Publish Events| Iris

-- ============================================================================
-- OUTBOX TABLE: CDC integration for event fanout
-- ============================================================================

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event data (JSONB for flexibility)
    event_data JSONB NOT NULL,
    
    -- Processing status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
    
    -- Routing information
    routing_key TEXT NOT NULL DEFAULT 'event.ingested',
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    
    -- Metadata
    source TEXT DEFAULT 'argus',
    version TEXT DEFAULT '1.0'
);

-- Indexes for efficient processing
CREATE INDEX idx_outbox_events_status ON outbox_events(status, created_at);
CREATE INDEX idx_outbox_events_pending ON outbox_events(status, next_retry_at) 
    WHERE status = 'pending';
CREATE INDEX idx_outbox_events_routing ON outbox_events(routing_key);

COMMENT ON TABLE outbox_events IS 'Outbox table for CDC - Argus events ready for Chronos processing';
COMMENT ON COLUMN outbox_events.event_data IS 'Complete event data in JSON format';
COMMENT ON COLUMN outbox_events.status IS 'Processing status: pending, published, or failed';
COMMENT ON COLUMN outbox_events.routing_key IS 'Message routing key for Iris fanout';

-- ============================================================================
-- OUTBOX FUNCTIONS: Helper functions for outbox management
-- ============================================================================

-- Add event to outbox (replaces direct event insertion)
CREATE OR REPLACE FUNCTION add_event_to_outbox(
    p_event_data JSONB,
    p_routing_key TEXT DEFAULT 'event.ingested',
    p_source TEXT DEFAULT 'argus'
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_outbox_id UUID;
BEGIN
    -- First create the event in nodes/event_details (existing pattern)
    INSERT INTO nodes (node_type, name, source)
    VALUES ('event', p_event_data->>'title', 'llm')
    RETURNING id INTO v_event_id;
    
    INSERT INTO event_details (
        node_id, title, summary, category, severity,
        location_name, lng, lat, region,
        timestamp, fallout_prediction, sources
    ) VALUES (
        v_event_id,
        p_event_data->>'title',
        p_event_data->>'summary', 
        p_event_data->>'category',
        p_event_data->>'severity',
        p_event_data->>'location_name',
        COALESCE((p_event_data->>'lng')::float, 0.0),
        COALESCE((p_event_data->>'lat')::float, 0.0),
        p_event_data->>'region',
        p_event_data->>'timestamp',
        p_event_data->>'fallout_prediction',
        p_event_data->'sources'
    );
    
    -- Add to outbox for CDC processing
    INSERT INTO outbox_events (event_data, routing_key, source)
    VALUES (
        jsonb_build_object(
            'event_id', v_event_id,
            'routing_key', p_routing_key,
            'data', p_event_data,
            'fanout_config', p_event_data->'fanout_config' DEFAULT '{}'
        ),
        p_routing_key,
        p_source
    )
    RETURNING id INTO v_outbox_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_event_to_outbox IS 'Add event to both Atlas and outbox for CDC processing';

-- Update outbox status (used by Chronos)
CREATE OR REPLACE FUNCTION mark_outbox_published(
    p_outbox_id UUID,
    p_error_message TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_status TEXT := 'published';
BEGIN
    IF p_error_message IS NOT NULL THEN
        v_status := 'failed';
    END IF;
    
    UPDATE outbox_events
    SET 
        status = v_status,
        error_message = p_error_message,
        published_at = CASE WHEN v_status = 'published' THEN NOW() ELSE published_at END,
        retry_count = CASE 
            WHEN v_status = 'failed' THEN retry_count + 1 
            ELSE retry_count 
        END,
        next_retry_at = CASE 
            WHEN v_status = 'failed' AND retry_count + 1 < max_retries 
            THEN NOW() + INTERVAL '5 minutes' * (retry_count + 1)
            ELSE NULL
        END
    WHERE id = p_outbox_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_outbox_published IS 'Mark outbox entry as published or failed';

-- Get pending events for processing (used by Chronos)
CREATE OR REPLACE FUNCTION get_pending_outbox_events(
    p_limit INTEGER DEFAULT 100
) RETURNS TABLE (
    id UUID,
    event_data JSONB,
    routing_key TEXT,
    created_at TIMESTAMPTZ
) AS $$
SELECT 
    oe.id,
    oe.event_data,
    oe.routing_key,
    oe.created_at
FROM outbox_events oe
WHERE oe.status = 'pending'
AND (oe.next_retry_at IS NULL OR oe.next_retry_at <= NOW())
ORDER BY oe.created_at ASC
LIMIT p_limit;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_pending_outbox_events IS 'Get pending events for Chronos to process';

-- ============================================================================
-- TRIGGERS: Keep outbox in sync with events
-- ============================================================================

-- Ensure outbox entries are cleaned up when events are deleted
CREATE OR REPLACE FUNCTION cleanup_outbox_for_deleted_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark any outbox entries for this event as failed
    UPDATE outbox_events
    SET 
        status = 'failed',
        error_message = 'Event deleted from Atlas',
        published_at = NOW()
    WHERE (event_data->>'event_id')::uuid = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_outbox_on_event_delete
    AFTER DELETE ON nodes
    FOR EACH ROW
    WHEN (OLD.node_type = 'event')
    EXECUTE FUNCTION cleanup_outbox_for_deleted_event();

-- ============================================================================
-- RLS: Secure outbox access
-- ============================================================================

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (will be restricted when auth is implemented)
CREATE POLICY "Allow all access to outbox_events" 
    ON outbox_events FOR ALL USING (true);

-- ============================================================================
-- MONITORING: Outbox health views
-- ============================================================================

-- Outbox health dashboard
CREATE VIEW outbox_health AS
SELECT 
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'published') as published,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '1 hour') as published_last_hour,
    AVG(EXTRACT(EPOCH FROM (published_at - created_at))) as avg_publish_time_seconds
FROM outbox_events;

COMMENT ON VIEW outbox_health IS 'Dashboard view for outbox system health';