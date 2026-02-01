-- Entity RPC Functions for Frontend
-- Provides get_event_entities and get_entity_events for displaying graph data

-- ============================================================================
-- get_event_entities: Given an event, return all linked entities
-- ============================================================================
-- Used by: Event cards, event popups to show entity badges
-- Example: "China announces Taiwan exercises" → [China, Taiwan, TSMC, Taiwan Strait]

CREATE OR REPLACE FUNCTION get_event_entities(event_uuid UUID)
RETURNS TABLE (
  entity_id UUID,
  name TEXT,
  node_type TEXT,
  relation_type TEXT,
  hit_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.name,
    n.node_type,
    e.relation_type,
    n.hit_count
  FROM edges e
  JOIN nodes n ON e.target_id = n.id
  WHERE e.source_id = event_uuid
    AND e.relation_type IN ('involves', 'affects', 'occurred_in', 'mentions')
    AND n.node_type != 'event'  -- Don't return other events
  ORDER BY 
    -- Priority: involves > affects > occurred_in > mentions
    CASE e.relation_type 
      WHEN 'involves' THEN 1 
      WHEN 'affects' THEN 2 
      WHEN 'occurred_in' THEN 3 
      ELSE 4 
    END,
    n.hit_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_event_entities(UUID) IS 
  'Returns all entities linked to an event, ordered by relationship importance';


-- ============================================================================
-- get_entity_events: Given an entity, return all events it appears in
-- ============================================================================
-- Used by: Entity detail pages, "See all events about X" feature
-- Example: TSMC entity → [list of 50 most recent events mentioning TSMC]

CREATE OR REPLACE FUNCTION get_entity_events(
  entity_uuid UUID, 
  max_count INT DEFAULT 50
)
RETURNS TABLE (
  event_id UUID,
  title TEXT,
  summary TEXT,
  category TEXT,
  severity INTEGER,
  event_timestamp TIMESTAMPTZ,
  relation_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ev.id,
    ed.title,
    ed.summary,
    ed.category,
    ed.severity,
    ed.timestamp,
    e.relation_type
  FROM edges e
  JOIN nodes ev ON e.source_id = ev.id
  JOIN event_details ed ON ed.node_id = ev.id
  WHERE e.target_id = entity_uuid
    AND ev.node_type = 'event'
  ORDER BY ed.timestamp DESC
  LIMIT max_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_entity_events(UUID, INT) IS 
  'Returns recent events that mention/involve a given entity';
