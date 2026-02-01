-- ============================================================================
-- Migration: Add CAMEO code support to insert_event RPC
-- ============================================================================
-- Adds p_cameo_code and p_cameo_label parameters to the insert_event function
-- so Argus can store CAMEO event classification codes.
-- ============================================================================

-- Drop and recreate the function with new parameters
-- (CREATE OR REPLACE doesn't work when changing function signature)
DROP FUNCTION IF EXISTS insert_event(
    TEXT, TEXT, TEXT, INTEGER, TEXT, FLOAT, FLOAT, TEXT, TIMESTAMPTZ, TEXT, JSONB, halfvec(3072)
);

CREATE OR REPLACE FUNCTION insert_event(
    p_title TEXT,
    p_summary TEXT,
    p_category TEXT,
    p_severity INTEGER,
    p_location_name TEXT,
    p_lng FLOAT,
    p_lat FLOAT,
    p_region TEXT,
    p_timestamp TIMESTAMPTZ,
    p_fallout_prediction TEXT,
    p_sources JSONB,
    p_embedding halfvec(3072) DEFAULT NULL,
    p_cameo_code INTEGER DEFAULT NULL,
    p_cameo_label TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_node_id UUID;
BEGIN
    -- Create the node
    INSERT INTO nodes (node_type, name, embedding, source)
    VALUES ('event', p_title, p_embedding, 'llm')
    RETURNING id INTO v_node_id;
    
    -- Create the event details (including CAMEO fields)
    INSERT INTO event_details (
        node_id, title, summary, category, severity,
        location_name, lng, lat, region,
        timestamp, fallout_prediction, sources,
        cameo_code, cameo_label
    ) VALUES (
        v_node_id, p_title, p_summary, p_category, p_severity,
        p_location_name, p_lng, p_lat, p_region,
        p_timestamp, p_fallout_prediction, p_sources,
        p_cameo_code, p_cameo_label
    );
    
    RETURN v_node_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION insert_event IS 'Insert a new event with all required fields including optional CAMEO classification';
