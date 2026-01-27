-- Constellation Enhancements: Edge Weights, Entity Resolution, Temporal
-- 
-- This migration adds:
-- 1. Edge weight columns (percentage, polarity, hit_count, freshness)
-- 2. Computed traversal_weight column
-- 3. Entity aliases table for fast resolution
-- 4. GiST index for temporal range queries
-- 5. Exclusion constraint for leadership overlaps
-- 6. Improved traversal function with LATERAL limits
-- 7. pgmq queue for ingestion spikes (optional)

-- ============================================================================
-- EDGE WEIGHT COLUMNS
-- ============================================================================

-- Add weight dimensions to edges
ALTER TABLE edges 
    ADD COLUMN IF NOT EXISTS percentage FLOAT 
        CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
    ADD COLUMN IF NOT EXISTS polarity FLOAT 
        CHECK (polarity IS NULL OR (polarity >= -1 AND polarity <= 1)),
    ADD COLUMN IF NOT EXISTS hit_count INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_confirmed TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN edges.percentage IS 'Relationship strength as percentage (0-100). E.g., "TSMC supplies 90% of Apple chips"';
COMMENT ON COLUMN edges.polarity IS 'Cooperative (+1) to adversarial (-1). E.g., allies=+0.9, sanctions=-0.8';
COMMENT ON COLUMN edges.hit_count IS 'Number of events referencing this edge';
COMMENT ON COLUMN edges.last_confirmed IS 'When this edge was last referenced by an event';

-- ============================================================================
-- COMPUTED TRAVERSAL WEIGHT
-- ============================================================================

-- Function to compute traversal weight from dimensions
-- Can't use GENERATED ALWAYS AS with freshness decay, so we use a function
CREATE OR REPLACE FUNCTION compute_traversal_weight(
    p_percentage FLOAT,
    p_confidence FLOAT,
    p_last_confirmed TIMESTAMPTZ,
    p_hit_count INTEGER
) RETURNS FLOAT AS $$
DECLARE
    strength FLOAT;
    conf FLOAT;
    freshness FLOAT;
    evidence FLOAT;
    days_old FLOAT;
BEGIN
    -- Strength (percentage, default 50 if unknown)
    strength := COALESCE(p_percentage, 50) / 100.0;
    
    -- Confidence (default 0.6)
    conf := COALESCE(p_confidence, 0.6);
    
    -- Freshness decay (half-life of 180 days)
    days_old := EXTRACT(EPOCH FROM (NOW() - COALESCE(p_last_confirmed, NOW()))) / 86400.0;
    freshness := POWER(0.5, days_old / 180.0);
    
    -- Evidence weight (log scale, caps at 10 hits)
    evidence := LEAST(1.0, LN(COALESCE(p_hit_count, 1) + 1) / LN(11));
    
    -- Weighted combination
    RETURN (
        strength * 0.4 +
        conf * 0.3 +
        freshness * 0.2 +
        evidence * 0.1
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION compute_traversal_weight IS 'Compute combined edge weight for graph traversal decisions';

-- Add traversal_weight as computed column (requires Postgres 12+)
-- We use a stored computed column for performance
ALTER TABLE edges 
    ADD COLUMN IF NOT EXISTS traversal_weight FLOAT 
    GENERATED ALWAYS AS (
        (COALESCE(percentage, 50) / 100.0) * 0.4 +
        COALESCE(confidence, 0.6) * 0.3 +
        0.9 * 0.2 +  -- Simplified freshness (use function for full calc)
        LEAST(1.0, LN(COALESCE(hit_count, 1) + 1) / LN(11)) * 0.1
    ) STORED;

-- Index for efficient traversal ordering
CREATE INDEX IF NOT EXISTS idx_edges_traversal_weight 
    ON edges(source_id, traversal_weight DESC);

-- ============================================================================
-- ENTITY ALIASES TABLE (Fast Exact-Match Resolution)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_aliases (
    alias TEXT PRIMARY KEY,
    canonical_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case-insensitive lookup
CREATE INDEX IF NOT EXISTS idx_aliases_lower ON entity_aliases (LOWER(alias));

-- Enable RLS
ALTER TABLE entity_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to entity_aliases" ON entity_aliases FOR ALL USING (true);

COMMENT ON TABLE entity_aliases IS 'Fast exact-match lookup for entity resolution. First pass before semantic search.';

-- Function to sync aliases from nodes.aliases array
CREATE OR REPLACE FUNCTION sync_node_aliases()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete old aliases for this node
    DELETE FROM entity_aliases WHERE canonical_id = NEW.id;
    
    -- Insert new aliases
    INSERT INTO entity_aliases (alias, canonical_id)
    SELECT LOWER(unnest(NEW.aliases)), NEW.id
    ON CONFLICT (alias) DO UPDATE SET canonical_id = EXCLUDED.canonical_id;
    
    -- Also add the name and slug as aliases
    INSERT INTO entity_aliases (alias, canonical_id) 
    VALUES (LOWER(NEW.name), NEW.id)
    ON CONFLICT (alias) DO NOTHING;
    
    IF NEW.slug IS NOT NULL THEN
        INSERT INTO entity_aliases (alias, canonical_id) 
        VALUES (LOWER(NEW.slug), NEW.id)
        ON CONFLICT (alias) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_aliases
    AFTER INSERT OR UPDATE OF aliases, name, slug ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION sync_node_aliases();

-- ============================================================================
-- TEMPORAL RANGE SUPPORT (GiST Index)
-- ============================================================================

-- Create a proper range column for temporal queries
ALTER TABLE edges 
    ADD COLUMN IF NOT EXISTS validity TSTZRANGE;

-- Populate validity from valid_from/valid_to
UPDATE edges SET validity = TSTZRANGE(valid_from, valid_to, '[)')
WHERE validity IS NULL AND (valid_from IS NOT NULL OR valid_to IS NOT NULL);

-- Keep validity in sync with valid_from/valid_to via trigger
CREATE OR REPLACE FUNCTION sync_validity_range()
RETURNS TRIGGER AS $$
BEGIN
    NEW.validity := TSTZRANGE(NEW.valid_from, NEW.valid_to, '[)');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_validity
    BEFORE INSERT OR UPDATE OF valid_from, valid_to ON edges
    FOR EACH ROW
    EXECUTE FUNCTION sync_validity_range();

-- GiST index for range overlap queries (B-Tree doesn't work for &&)
CREATE INDEX IF NOT EXISTS idx_edges_validity_gist 
    ON edges USING GiST (validity);

COMMENT ON COLUMN edges.validity IS 'Temporal range for fast overlap queries. Auto-synced from valid_from/valid_to.';

-- ============================================================================
-- EXCLUSION CONSTRAINT: Leadership Overlaps
-- ============================================================================

-- Prevent two people from being leader of the same country at the same time
-- Using a partial exclusion constraint
ALTER TABLE edges DROP CONSTRAINT IF EXISTS no_overlapping_leadership;

-- Need btree_gist extension for mixing = with &&
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE edges 
    ADD CONSTRAINT no_overlapping_leadership
    EXCLUDE USING GiST (
        target_id WITH =,
        relation_type WITH =,
        validity WITH &&
    ) WHERE (relation_type = 'leader_of' AND validity IS NOT NULL);

COMMENT ON CONSTRAINT no_overlapping_leadership ON edges IS 
    'Prevents overlapping leadership edges (e.g., two presidents of Niger at the same time)';

-- ============================================================================
-- HUB NODE TRACKING
-- ============================================================================

-- Add is_hub flag to nodes for special traversal handling
ALTER TABLE nodes 
    ADD COLUMN IF NOT EXISTS is_hub BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_nodes_hub ON nodes(is_hub) WHERE is_hub = TRUE;

COMMENT ON COLUMN nodes.is_hub IS 'Hub nodes (USA, China, NATO) get special traversal limits';

-- ============================================================================
-- IMPROVED TRAVERSAL FUNCTION (LATERAL Limits)
-- ============================================================================

-- Drop old function if exists
DROP FUNCTION IF EXISTS get_impact_chain(UUID, INT);

-- New function with LATERAL limits to prevent supernode explosion
-- Uses plpgsql to work around recursive CTE ORDER BY/LIMIT restrictions
CREATE OR REPLACE FUNCTION get_impact_chain(
    start_node_id UUID,
    max_depth INT DEFAULT 3,
    min_weight FLOAT DEFAULT 0.3,
    min_cumulative FLOAT DEFAULT 0.1,
    edges_per_node INT DEFAULT 20
) RETURNS TABLE (
    id UUID,
    node_type TEXT,
    name TEXT,
    depth INT,
    cumulative_weight FLOAT,
    path JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE impact AS (
        -- Base case: direct connections from start node (use subquery for LIMIT)
        SELECT * FROM (
            SELECT 
                e.target_id as id,
                1 as depth,
                e.traversal_weight as cumulative_weight,
                jsonb_build_array(jsonb_build_object(
                    'from', start_node_id,
                    'to', e.target_id,
                    'rel', e.relation_type,
                    'weight', e.traversal_weight
                )) as path,
                ARRAY[start_node_id, e.target_id] as visited
            FROM edges e
            WHERE e.source_id = start_node_id
                AND e.traversal_weight >= min_weight
                AND (e.valid_to IS NULL OR e.valid_to > NOW())
            ORDER BY e.traversal_weight DESC
            LIMIT edges_per_node
        ) base
        
        UNION ALL
        
        -- Recursive case: traverse with LATERAL limits
        SELECT 
            next_edge.target_id,
            i.depth + 1,
            i.cumulative_weight * next_edge.traversal_weight,
            i.path || jsonb_build_object(
                'from', i.id,
                'to', next_edge.target_id,
                'rel', next_edge.relation_type,
                'weight', next_edge.traversal_weight
            ),
            i.visited || next_edge.target_id
        FROM impact i
        CROSS JOIN LATERAL (
            -- This subquery runs PER ROW with its own LIMIT
            SELECT e.target_id, e.relation_type, e.traversal_weight
            FROM edges e
            WHERE e.source_id = i.id
                AND e.traversal_weight >= min_weight
                AND (e.valid_to IS NULL OR e.valid_to > NOW())
                AND NOT e.target_id = ANY(i.visited)  -- Prevent cycles
            ORDER BY e.traversal_weight DESC
            LIMIT edges_per_node  -- CRITICAL: Hard cap per node
        ) next_edge
        WHERE i.depth < max_depth
            AND i.cumulative_weight * next_edge.traversal_weight >= min_cumulative
    )
    SELECT DISTINCT ON (i.id)
        i.id,
        n.node_type,
        n.name,
        i.depth,
        i.cumulative_weight,
        i.path
    FROM impact i
    JOIN nodes n ON i.id = n.id
    ORDER BY i.id, i.cumulative_weight DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_impact_chain IS 
    'Traverse impact chain with LATERAL limits to prevent supernode explosion. Returns affected entities with cumulative weights.';

-- ============================================================================
-- TWO-PASS ENTITY RESOLUTION
-- ============================================================================

-- Fast path: exact alias match
CREATE OR REPLACE FUNCTION resolve_entity_fast(entity_name TEXT)
RETURNS UUID AS $$
    SELECT canonical_id 
    FROM entity_aliases 
    WHERE LOWER(alias) = LOWER(entity_name)
    LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Slow path: semantic search (call this if fast path returns NULL)
CREATE OR REPLACE FUNCTION resolve_entity_semantic(
    entity_name TEXT,
    entity_embedding halfvec(3072),
    entity_type TEXT DEFAULT NULL,
    min_similarity FLOAT DEFAULT 0.85
) RETURNS TABLE (
    id UUID,
    name TEXT,
    similarity FLOAT
) AS $$
    SELECT 
        n.id,
        n.name,
        1 - (n.embedding <=> entity_embedding) as similarity
    FROM nodes n
    WHERE (entity_type IS NULL OR n.node_type = entity_type)
        AND n.embedding IS NOT NULL
        AND 1 - (n.embedding <=> entity_embedding) >= min_similarity
    ORDER BY n.embedding <=> entity_embedding
    LIMIT 5;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION resolve_entity_fast IS 'Pass 1: Fast exact-match entity resolution via aliases table';
COMMENT ON FUNCTION resolve_entity_semantic IS 'Pass 2: Semantic similarity entity resolution for new/unknown names';

-- ============================================================================
-- EDGE INCREMENT FUNCTION
-- ============================================================================

-- When an event references an existing edge, increment hit_count and update last_confirmed
CREATE OR REPLACE FUNCTION edge_touch(
    p_source_id UUID,
    p_target_id UUID,
    p_relation_type TEXT
) RETURNS UUID AS $$
DECLARE
    edge_id UUID;
BEGIN
    UPDATE edges 
    SET hit_count = hit_count + 1,
        last_confirmed = NOW()
    WHERE source_id = p_source_id 
        AND target_id = p_target_id 
        AND relation_type = p_relation_type
        AND (valid_to IS NULL OR valid_to > NOW())
    RETURNING id INTO edge_id;
    
    RETURN edge_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION edge_touch IS 'Increment hit_count and update last_confirmed when an edge is referenced';

-- ============================================================================
-- SEED HUB NODES
-- ============================================================================

-- Mark known hub nodes (run after initial data load)
-- This is idempotent, can run multiple times
DO $$
BEGIN
    UPDATE nodes SET is_hub = TRUE 
    WHERE slug IN (
        'usa', 'united-states', 'china', 'russia', 'eu', 'european-union',
        'nato', 'india', 'uk', 'united-kingdom', 'japan', 'germany', 'france',
        'saudi-arabia', 'iran', 'israel', 'ukraine', 'taiwan',
        'tsmc', 'apple', 'nvidia', 'saudi-aramco', 'gazprom',
        'taiwan-strait', 'strait-of-hormuz', 'suez-canal', 'strait-of-malacca',
        'un', 'united-nations', 'brics', 'opec', 'asean', 'wto'
    );
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON entity_aliases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON entity_aliases TO authenticated;

-- ============================================================================
-- QUEUE SETUP (Optional - requires pgmq extension)
-- ============================================================================

-- Uncomment if using pgmq for ingestion queues
-- Note: May need to install pgmq extension first
/*
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create queues for the ingestion pipeline
SELECT pgmq.create('event_enrichment');
SELECT pgmq.create('entity_resolution');
SELECT pgmq.create('graph_updates');

COMMENT ON EXTENSION pgmq IS 'Postgres-native message queue for ingestion spike protection';
*/
