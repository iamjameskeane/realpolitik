-- Search Entities by Embedding
-- 
-- RPC function for Pass 2 of entity resolution (semantic similarity search).
-- Called when Pass 1 (alias lookup) fails to find a match.

CREATE OR REPLACE FUNCTION search_entities_by_embedding(
    query_embedding halfvec(3072),
    entity_type_filter TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.15,  -- cosine distance (lower = more similar)
    match_count INT DEFAULT 5
) RETURNS TABLE (
    id UUID,
    name TEXT,
    similarity FLOAT
) AS $$
SELECT 
    n.id,
    n.name,
    1 - (n.embedding <=> query_embedding) as similarity
FROM nodes n
WHERE n.node_type != 'event'  -- Only entities, not events
  AND (entity_type_filter IS NULL OR n.node_type = entity_type_filter)
  AND n.embedding IS NOT NULL
  AND (n.embedding <=> query_embedding) <= match_threshold
ORDER BY n.embedding <=> query_embedding
LIMIT match_count;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION search_entities_by_embedding IS 
    'Find entities by embedding similarity. Used for Pass 2 of two-pass entity resolution.';

-- Grant access
GRANT EXECUTE ON FUNCTION search_entities_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION search_entities_by_embedding TO service_role;
