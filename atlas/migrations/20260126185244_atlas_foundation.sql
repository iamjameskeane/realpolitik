-- Atlas Foundation: Unified Knowledge Graph for Realpolitik
-- 
-- This migration creates the core schema for the Atlas intelligence layer.
-- Designed to match existing GeoEvent schema for seamless frontend migration.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy text matching

-- ============================================================================
-- NODES: Everything in the graph (entities + events)
-- ============================================================================

CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    slug TEXT UNIQUE,  -- 'usa', 'tsmc', 'evt-2026-01-15-houthi-attack'
    node_type TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    
    -- Flexible properties (type-specific data stored as JSONB)
    properties JSONB DEFAULT '{}'::jsonb,
    
    -- Semantic search (3072 dims, stored as half precision)
    embedding halfvec(3072),
    
    -- Provenance
    source TEXT DEFAULT 'llm' CHECK (source IN ('curated', 'llm', 'user')),
    verified BOOLEAN DEFAULT FALSE,
    hit_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Node types:
-- Entities: country, company, leader, organization, facility, 
--           chokepoint, commodity, product, sector
-- Events:   event

COMMENT ON TABLE nodes IS 'Unified graph nodes: entities and events';
COMMENT ON COLUMN nodes.slug IS 'URL-safe unique identifier';
COMMENT ON COLUMN nodes.aliases IS 'Alternative names for entity resolution';
COMMENT ON COLUMN nodes.properties IS 'Type-specific data (GDP, severity, etc.)';
COMMENT ON COLUMN nodes.embedding IS 'Vector embedding for semantic search';
COMMENT ON COLUMN nodes.hit_count IS 'Times referenced by events (for LLM node verification)';

-- ============================================================================
-- EDGES: All relationships
-- ============================================================================

CREATE TABLE edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationship endpoints
    source_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,
    
    -- Edge properties
    properties JSONB DEFAULT '{}'::jsonb,
    -- Common: detail (text), percentage (float), cameo_code (int)
    
    -- Causal modeling (primarily for event-event edges)
    confidence FLOAT CHECK (confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)),
    reasoning TEXT,
    
    -- Temporal validity (primarily for entity-entity edges)
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,  -- NULL = currently valid
    
    -- Provenance
    source TEXT DEFAULT 'llm' CHECK (source IN ('curated', 'llm', 'user')),
    verified BOOLEAN DEFAULT FALSE,
    source_node_id UUID REFERENCES nodes(id),  -- Which event established this edge?
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT no_self_loops CHECK (source_id != target_id)
);

COMMENT ON TABLE edges IS 'All relationships: entity-entity, event-entity, event-event';
COMMENT ON COLUMN edges.confidence IS 'LLM confidence in causal relationships (0.0-1.0)';
COMMENT ON COLUMN edges.reasoning IS 'LLM explanation for why this edge exists';
COMMENT ON COLUMN edges.valid_from IS 'When relationship became valid (for temporal queries)';
COMMENT ON COLUMN edges.valid_to IS 'When relationship ended (NULL = still valid)';

-- ============================================================================
-- EVENT DETAILS: Extended data for event nodes
-- Matches existing GeoEvent schema for frontend compatibility
-- ============================================================================

CREATE TABLE event_details (
    node_id UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- Core event fields (matching GeoEvent interface)
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('MILITARY', 'DIPLOMACY', 'ECONOMY', 'UNREST')),
    severity INTEGER CHECK (severity >= 1 AND severity <= 10),
    
    -- Location (matching GeoEvent: coordinates as [lng, lat])
    location_name TEXT NOT NULL,
    lng FLOAT NOT NULL,
    lat FLOAT NOT NULL,
    region TEXT CHECK (region IN (
        'MIDDLE_EAST', 'EAST_ASIA', 'SOUTHEAST_ASIA', 'SOUTH_ASIA', 
        'EUROPE', 'AFRICA', 'AMERICAS', 'CENTRAL_ASIA', 'OCEANIA', 'OTHER'
    )),
    
    -- Timestamps (matching GeoEvent)
    timestamp TIMESTAMPTZ NOT NULL,        -- Earliest source timestamp
    last_updated TIMESTAMPTZ,              -- Latest source timestamp
    
    -- Analysis
    fallout_prediction TEXT,               -- AI-generated prediction
    impact_summary TEXT,                   -- Sherman Kent style "why you should care" (V2)
    
    -- CAMEO coding (for escalation tracking - V2)
    cameo_code INTEGER,
    cameo_label TEXT,
    
    -- Sources (matching GeoEvent.sources array)
    sources JSONB NOT NULL DEFAULT '[]'::jsonb
    -- Format: [{id, headline, summary, source_name, source_url, timestamp, original_severity?}]
);

COMMENT ON TABLE event_details IS 'Extended data for event nodes, matching GeoEvent interface';
COMMENT ON COLUMN event_details.timestamp IS 'Earliest source timestamp (ISO 8601)';
COMMENT ON COLUMN event_details.last_updated IS 'Latest source timestamp (ISO 8601)';
COMMENT ON COLUMN event_details.fallout_prediction IS 'AI-generated prediction of consequences';
COMMENT ON COLUMN event_details.impact_summary IS 'V2: Sherman Kent style analysis';

-- ============================================================================
-- REACTIONS: User voting on events (migrated from Redis)
-- ============================================================================

CREATE TABLE reactions (
    event_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    user_fingerprint TEXT NOT NULL,  -- Anonymous user identifier (from browser)
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('critical', 'market', 'noise')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id, user_fingerprint)
);

COMMENT ON TABLE reactions IS 'User reactions/votes on events';
COMMENT ON COLUMN reactions.user_fingerprint IS 'Anonymous browser fingerprint for deduplication';

-- Aggregated view for fast reaction counts
CREATE VIEW reaction_counts AS
SELECT 
    event_id,
    COUNT(*) FILTER (WHERE reaction_type = 'critical') as critical,
    COUNT(*) FILTER (WHERE reaction_type = 'market') as market,
    COUNT(*) FILTER (WHERE reaction_type = 'noise') as noise,
    COUNT(*) as total
FROM reactions
GROUP BY event_id;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Nodes indexes
CREATE INDEX idx_nodes_type ON nodes(node_type);
CREATE INDEX idx_nodes_slug ON nodes(slug);
CREATE INDEX idx_nodes_aliases ON nodes USING GIN (aliases);
CREATE INDEX idx_nodes_properties ON nodes USING GIN (properties);
CREATE INDEX idx_nodes_created ON nodes(created_at DESC);

-- Full-text search on name
ALTER TABLE nodes ADD COLUMN search_vector TSVECTOR 
    GENERATED ALWAYS AS (to_tsvector('english', name)) STORED;
CREATE INDEX idx_nodes_search ON nodes USING GIN (search_vector);

-- Trigram index for fuzzy matching
CREATE INDEX idx_nodes_name_trgm ON nodes USING GIN (name gin_trgm_ops);

-- Vector index (HNSW for fast approximate nearest neighbor)
-- Tuned for 3072 dimensions: m=32, ef_construction=128
CREATE INDEX idx_nodes_embedding ON nodes 
    USING hnsw (embedding halfvec_cosine_ops) 
    WITH (m = 32, ef_construction = 128);

-- Edges indexes
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
CREATE INDEX idx_edges_relation ON edges(relation_type);
CREATE INDEX idx_edges_temporal ON edges(valid_from, valid_to) 
    WHERE valid_from IS NOT NULL OR valid_to IS NOT NULL;
CREATE INDEX idx_edges_created ON edges(created_at DESC);

-- Prevent duplicate active relationships (same source, target, relation with no end date)
CREATE UNIQUE INDEX idx_edges_unique_active ON edges (
    source_id, target_id, relation_type
) WHERE valid_to IS NULL;

-- Event details indexes
CREATE INDEX idx_event_details_category ON event_details(category);
CREATE INDEX idx_event_details_severity ON event_details(severity DESC);
CREATE INDEX idx_event_details_region ON event_details(region);
CREATE INDEX idx_event_details_timestamp ON event_details(timestamp DESC);

-- Reactions indexes
CREATE INDEX idx_reactions_event ON reactions(event_id);

-- ============================================================================
-- VIEWS: Frontend-compatible data access
-- ============================================================================

-- Events view: Returns data matching GeoEvent interface EXACTLY
CREATE VIEW events AS
SELECT 
    n.id::text as id,  -- Frontend expects string ID
    ed.title,
    ed.category,
    ARRAY[ed.lng, ed.lat] as coordinates,  -- [lng, lat] format
    ed.location_name,
    ed.region,
    ed.severity,
    ed.summary,
    ed.timestamp,
    ed.last_updated,
    ed.fallout_prediction,
    ed.sources,
    -- V2 fields (nullable for backwards compat)
    ed.impact_summary,
    ed.cameo_code,
    ed.cameo_label,
    -- Metadata
    n.embedding,
    n.created_at
FROM nodes n
JOIN event_details ed ON n.id = ed.node_id
WHERE n.node_type = 'event';

-- Events with reactions: Full data for frontend
CREATE VIEW events_with_reactions AS
SELECT 
    e.*,
    COALESCE(r.critical, 0) as reactions_critical,
    COALESCE(r.market, 0) as reactions_market,
    COALESCE(r.noise, 0) as reactions_noise,
    COALESCE(r.total, 0) as reactions_total
FROM events e
LEFT JOIN reaction_counts r ON e.id::uuid = r.event_id;

-- Entities view: Non-event nodes
CREATE VIEW entities AS
SELECT * FROM nodes WHERE node_type != 'event';

-- ============================================================================
-- FUNCTIONS: Graph Operations
-- ============================================================================

-- Get subgraph around a node (for visualization)
CREATE OR REPLACE FUNCTION get_subgraph(
    center_id UUID, 
    max_depth INT DEFAULT 2
) RETURNS JSONB AS $$
WITH RECURSIVE traversal AS (
    -- Start with center node
    SELECT id, 0 as depth FROM nodes WHERE id = center_id
    
    UNION
    
    -- Traverse outward through edges
    SELECT 
        CASE WHEN e.source_id = t.id THEN e.target_id ELSE e.source_id END,
        t.depth + 1
    FROM edges e
    JOIN traversal t ON (e.source_id = t.id OR e.target_id = t.id)
    WHERE t.depth < max_depth
    AND (e.valid_to IS NULL OR e.valid_to > NOW())  -- Only current edges
)
SELECT jsonb_build_object(
    'nodes', (
        SELECT COALESCE(jsonb_agg(row_to_json(n.*)), '[]'::jsonb)
        FROM nodes n 
        WHERE n.id IN (SELECT id FROM traversal)
    ),
    'edges', (
        SELECT COALESCE(jsonb_agg(row_to_json(e.*)), '[]'::jsonb)
        FROM edges e 
        WHERE e.source_id IN (SELECT id FROM traversal) 
        AND e.target_id IN (SELECT id FROM traversal)
        AND (e.valid_to IS NULL OR e.valid_to > NOW())
    )
);
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_subgraph IS 'Get nodes and edges within N hops of a center node';


-- Semantic search with optional type filter
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding halfvec(3072),
    match_count INT DEFAULT 10,
    filter_type TEXT DEFAULT NULL,
    min_similarity FLOAT DEFAULT 0.5
) RETURNS TABLE (
    id UUID,
    node_type TEXT,
    name TEXT,
    similarity FLOAT
) AS $$
SELECT 
    n.id,
    n.node_type,
    n.name,
    1 - (n.embedding <=> query_embedding) as similarity
FROM nodes n
WHERE (filter_type IS NULL OR n.node_type = filter_type)
AND n.embedding IS NOT NULL
AND 1 - (n.embedding <=> query_embedding) >= min_similarity
ORDER BY n.embedding <=> query_embedding
LIMIT match_count;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION semantic_search IS 'Find semantically similar nodes using vector search';


-- Hybrid search: combines vector similarity with full-text search using RRF
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding halfvec(3072),
    match_count INT DEFAULT 10,
    rrf_k INT DEFAULT 60
) RETURNS TABLE (
    id UUID,
    node_type TEXT,
    name TEXT,
    score FLOAT
) AS $$
WITH semantic AS (
    SELECT n.id, ROW_NUMBER() OVER (ORDER BY n.embedding <=> query_embedding) as rank
    FROM nodes n
    WHERE n.embedding IS NOT NULL
    ORDER BY n.embedding <=> query_embedding 
    LIMIT match_count * 2
),
keyword AS (
    SELECT n.id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(n.search_vector, plainto_tsquery('english', query_text)) DESC) as rank
    FROM nodes n
    WHERE n.search_vector @@ plainto_tsquery('english', query_text)
    LIMIT match_count * 2
)
SELECT 
    COALESCE(s.id, k.id) as id,
    n.node_type,
    n.name,
    (COALESCE(1.0 / (rrf_k + s.rank), 0.0) + COALESCE(1.0 / (rrf_k + k.rank), 0.0)) as score
FROM semantic s
FULL OUTER JOIN keyword k ON s.id = k.id
JOIN nodes n ON n.id = COALESCE(s.id, k.id)
ORDER BY score DESC
LIMIT match_count;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION hybrid_search IS 'Combined vector + keyword search using Reciprocal Rank Fusion';


-- Get causal chain leading to an event
CREATE OR REPLACE FUNCTION get_causal_chain(
    event_id UUID,
    max_depth INT DEFAULT 5
) RETURNS TABLE (
    id UUID,
    name TEXT,
    depth INT,
    relation TEXT,
    confidence FLOAT
) AS $$
WITH RECURSIVE chain AS (
    -- Start with direct causes
    SELECT 
        e.source_id as id,
        1 as depth,
        e.relation_type,
        e.confidence
    FROM edges e 
    WHERE e.target_id = event_id 
    AND e.relation_type IN ('caused', 'escalated', 'preceded', 'contributed_to')
    
    UNION ALL
    
    -- Walk backwards through causal edges
    SELECT 
        e.source_id,
        c.depth + 1,
        e.relation_type,
        e.confidence
    FROM edges e
    JOIN chain c ON e.target_id = c.id
    WHERE e.relation_type IN ('caused', 'escalated', 'preceded', 'contributed_to')
    AND c.depth < max_depth
)
SELECT 
    c.id,
    n.name,
    c.depth,
    c.relation_type,
    c.confidence
FROM chain c
JOIN nodes n ON c.id = n.id
ORDER BY c.depth;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_causal_chain IS 'Trace causal chain of events leading to a given event';


-- Get impact chain from an event (what it affects)
CREATE OR REPLACE FUNCTION get_impact_chain(
    event_id UUID,
    max_depth INT DEFAULT 3
) RETURNS TABLE (
    id UUID,
    node_type TEXT,
    name TEXT,
    depth INT,
    path JSONB
) AS $$
WITH RECURSIVE impact AS (
    -- Start with directly affected entities
    SELECT 
        e.target_id as id,
        1 as depth,
        jsonb_build_array(jsonb_build_object(
            'from', event_id,
            'to', e.target_id,
            'relation', e.relation_type
        )) as path
    FROM edges e 
    WHERE e.source_id = event_id 
    AND e.relation_type IN ('affects', 'involves', 'harms', 'benefits')
    
    UNION ALL
    
    -- Traverse through supply chains, dependencies, etc.
    SELECT 
        e.target_id,
        i.depth + 1,
        i.path || jsonb_build_object(
            'from', i.id,
            'to', e.target_id,
            'relation', e.relation_type
        )
    FROM edges e
    JOIN impact i ON e.source_id = i.id
    WHERE e.relation_type IN ('supplies', 'depends_on', 'hosts', 'makes')
    AND i.depth < max_depth
    AND (e.valid_to IS NULL OR e.valid_to > NOW())
)
SELECT 
    i.id,
    n.node_type,
    n.name,
    i.depth,
    i.path
FROM impact i
JOIN nodes n ON i.id = n.id
ORDER BY i.depth;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_impact_chain IS 'Trace downstream impacts of an event through the knowledge graph';


-- Resolve entity name to canonical node ID
CREATE OR REPLACE FUNCTION resolve_entity(
    entity_name TEXT
) RETURNS UUID AS $$
SELECT id FROM nodes
WHERE 
    -- Exact slug match
    slug = lower(replace(entity_name, ' ', '-'))
    -- Or name match (case insensitive)
    OR lower(name) = lower(entity_name)
    -- Or alias match
    OR lower(entity_name) = ANY(SELECT lower(unnest(aliases)))
ORDER BY 
    -- Prefer verified nodes
    verified DESC,
    -- Then by hit count
    hit_count DESC
LIMIT 1;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION resolve_entity IS 'Resolve entity name/alias to canonical node ID';


-- Insert an event (convenience function)
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
    p_embedding halfvec(3072) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_node_id UUID;
BEGIN
    -- Create the node
    INSERT INTO nodes (node_type, name, embedding, source)
    VALUES ('event', p_title, p_embedding, 'llm')
    RETURNING id INTO v_node_id;
    
    -- Create the event details
    INSERT INTO event_details (
        node_id, title, summary, category, severity,
        location_name, lng, lat, region,
        timestamp, fallout_prediction, sources
    ) VALUES (
        v_node_id, p_title, p_summary, p_category, p_severity,
        p_location_name, p_lng, p_lat, p_region,
        p_timestamp, p_fallout_prediction, p_sources
    );
    
    RETURN v_node_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION insert_event IS 'Insert a new event with all required fields';


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on nodes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_nodes_updated_at
    BEFORE UPDATE ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- For now, allow all access (will be restricted when auth is added)
CREATE POLICY "Allow all access to nodes" ON nodes FOR ALL USING (true);
CREATE POLICY "Allow all access to edges" ON edges FOR ALL USING (true);
CREATE POLICY "Allow all access to event_details" ON event_details FOR ALL USING (true);
CREATE POLICY "Allow all access to reactions" ON reactions FOR ALL USING (true);


-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Seed data will be added in a separate migration after verification.
-- See: supabase/seeds/atlas_backbone.sql (to be created)
