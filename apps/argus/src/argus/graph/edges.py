"""
Edge operations for the knowledge graph.
"""

import math
from datetime import datetime, timedelta, timezone
import asyncio


async def detect_hub_nodes(conn, min_degree: int = 50, recent_days: int = 30) -> list[str]:
    """
    Detect hub nodes based on degree and activity.
    
    A hub node is one with high degree (many connections) and recent activity.
    Uses both in-degree and out-degree for comprehensive detection.
    
    Args:
        conn: PostgreSQL connection
        min_degree: Minimum degree to be considered a hub
        recent_days: Only consider edges from last N days for activity calculation
    
    Returns:
        List of hub node UUIDs
    """
    query = """
        WITH node_degrees AS (
            -- Count total edges per node (both incoming and outgoing)
            SELECT 
                n.id,
                n.name,
                n.node_type,
                COALESCE(outgoing.out_degree, 0) + COALESCE(incoming.in_degree, 0) as total_degree,
                COALESCE(recent.recent_degree, 0) as recent_degree
            FROM nodes n
            LEFT JOIN (
                SELECT source_id, COUNT(*) as out_degree
                FROM edges
                GROUP BY source_id
            ) outgoing ON n.id = outgoing.source_id
            LEFT JOIN (
                SELECT target_id, COUNT(*) as in_degree
                FROM edges
                GROUP BY target_id
            ) incoming ON n.id = incoming.target_id
            LEFT JOIN (
                SELECT 
                    e1.source_id as node_id,
                    COUNT(*) as recent_degree
                FROM edges e1
                WHERE e1.last_confirmed >= NOW() - INTERVAL '%s days'
                GROUP BY e1.source_id
                UNION
                SELECT 
                    e2.target_id as node_id,
                    COUNT(*) as recent_degree
                FROM edges e2
                WHERE e2.last_confirmed >= NOW() - INTERVAL '%s days'
                GROUP BY e2.target_id
            ) recent ON n.id = recent.node_id
            WHERE n.node_type != 'event'  -- Only entities can be hubs
        )
        SELECT id, name, total_degree, recent_degree
        FROM node_degrees
        WHERE total_degree >= $1 
        AND (recent_degree >= $2 OR total_degree >= $1 * 2)
        ORDER BY total_degree DESC
    """ % (recent_days, min_degree // 4)
    
    results = await conn.fetch(query, min_degree, min_degree // 4)
    return [str(row['id']) for row in results]


async def update_hub_status(conn, node_ids: list[str] | None = None) -> None:
    """
    Update is_hub flag for nodes based on hub detection.
    
    Args:
        conn: PostgreSQL connection
        node_ids: Optional list of specific node IDs to check (for incremental updates)
    """
    if node_ids:
        # Check specific nodes
        query = """
            WITH node_degrees AS (
                SELECT 
                    n.id,
                    COALESCE(outgoing.out_degree, 0) + COALESCE(incoming.in_degree, 0) as total_degree
                FROM nodes n
                LEFT JOIN (
                    SELECT source_id, COUNT(*) as out_degree
                    FROM edges
                    GROUP BY source_id
                ) outgoing ON n.id = outgoing.source_id
                LEFT JOIN (
                    SELECT target_id, COUNT(*) as in_degree
                    FROM edges
                    GROUP BY target_id
                ) incoming ON n.id = incoming.target_id
                WHERE n.id = ANY($1) AND n.node_type != 'event'
            )
            SELECT id FROM node_degrees WHERE total_degree >= 50
        """
        results = await conn.fetch(query, node_ids)
        hub_ids = [str(row['id']) for row in results]
    else:
        # Detect all hubs
        hub_ids = await detect_hub_nodes(conn)
    
    # Update hub status
    if hub_ids:
        await conn.execute("""
            UPDATE nodes 
            SET is_hub = true 
            WHERE id = ANY($1)
        """, hub_ids)
        
        # Set non-hubs to false
        await conn.execute("""
            UPDATE nodes 
            SET is_hub = false 
            WHERE id != ALL($1) AND node_type != 'event'
        """, hub_ids)
        
        print(f"   ✓ Updated hub status for {len(hub_ids)} nodes")
    else:
        # No hubs detected, clear all
        await conn.execute("""
            UPDATE nodes 
            SET is_hub = false 
            WHERE node_type != 'event'
        """)
        print(f"   ✓ No hub nodes detected")


async def get_top_hubs(conn, limit: int = 10) -> list[dict]:
    """
    Get the top hub nodes by degree.
    
    Args:
        conn: PostgreSQL connection
        limit: Maximum number of hubs to return
    
    Returns:
        List of hub node information with degrees
    """
    query = """
        WITH node_degrees AS (
            SELECT 
                n.id,
                n.name,
                n.node_type,
                COALESCE(outgoing.out_degree, 0) + COALESCE(incoming.in_degree, 0) as total_degree,
                COALESCE(recent.recent_degree, 0) as recent_degree
            FROM nodes n
            LEFT JOIN (
                SELECT source_id, COUNT(*) as out_degree
                FROM edges
                GROUP BY source_id
            ) outgoing ON n.id = outgoing.source_id
            LEFT JOIN (
                SELECT target_id, COUNT(*) as in_degree
                FROM edges
                GROUP BY target_id
            ) incoming ON n.id = incoming.target_id
            LEFT JOIN (
                SELECT 
                    e1.source_id as node_id,
                    COUNT(*) as recent_degree
                FROM edges e1
                WHERE e1.last_confirmed >= NOW() - INTERVAL '30 days'
                GROUP BY e1.source_id
                UNION
                SELECT 
                    e2.target_id as node_id,
                    COUNT(*) as recent_degree
                FROM edges e2
                WHERE e2.last_confirmed >= NOW() - INTERVAL '30 days'
                GROUP BY e2.target_id
            ) recent ON n.id = recent.node_id
            WHERE n.node_type != 'event' AND n.is_hub = true
        )
        SELECT id, name, node_type, total_degree, recent_degree
        FROM node_degrees
        ORDER BY total_degree DESC
        LIMIT $1
    """
    
    results = await conn.fetch(query, limit)
    return [
        {
            'id': str(row['id']),
            'name': row['name'],
            'node_type': row['node_type'],
            'total_degree': row['total_degree'],
            'recent_degree': row['recent_degree']
        }
        for row in results
    ]


def calculate_freshness_weight(last_confirmed: datetime) -> float:
    """
    Calculate freshness decay weight.
    
    Uses half-life of 180 days:
    - Today: 1.0
    - 6 months ago: 0.5
    - 1 year ago: 0.25
    
    Args:
        last_confirmed: When the edge was last confirmed
    
    Returns:
        Freshness weight (0-1)
    """
    days_old = (datetime.now(timezone.utc) - last_confirmed).days
    half_life_days = 180
    return 0.5 ** (days_old / half_life_days)


def calculate_evidence_weight(hit_count: int) -> float:
    """
    Calculate evidence weight based on hit count.
    
    Uses logarithmic scale with diminishing returns after ~10 hits:
    - 0 hits: 0.0
    - 1 hit: 0.3
    - 5 hits: 0.7
    - 10+ hits: 1.0
    
    Args:
        hit_count: Number of times this edge was observed
    
    Returns:
        Evidence weight (0-1)
    """
    if hit_count == 0:
        return 0.0
    return min(1.0, math.log(hit_count + 1) / math.log(11))


def calculate_traversal_weight(
    percentage: float | None,
    confidence: float,
    last_confirmed: datetime,
    hit_count: int,
    strength_multiplier: float = 0.4,
    confidence_multiplier: float = 0.3,
    freshness_multiplier: float = 0.2,
    evidence_multiplier: float = 0.1
) -> float:
    """
    Calculate combined traversal weight for graph traversal.
    
    Combines multiple dimensions into a single weight:
    - Strength: Relationship magnitude (percentage)
    - Confidence: Trust in the edge
    - Freshness: Recency of confirmation
    - Evidence: Number of supporting observations
    
    Args:
        percentage: Relationship strength (0-100) or None
        confidence: Confidence score (0-1)
        last_confirmed: When edge was last confirmed
        hit_count: Number of observations
        strength_multiplier: Weight for strength component
        confidence_multiplier: Weight for confidence component
        freshness_multiplier: Weight for freshness component
        evidence_multiplier: Weight for evidence component
    
    Returns:
        Combined traversal weight (0-1)
    """
    # Normalize percentage to 0-1
    strength = (percentage or 50) / 100
    
    # Calculate component weights
    freshness = calculate_freshness_weight(last_confirmed)
    evidence = calculate_evidence_weight(hit_count)
    
    # Weighted combination
    return (
        strength * strength_multiplier +
        confidence * confidence_multiplier +
        freshness * freshness_multiplier +
        evidence * evidence_multiplier
    )


async def upsert_edge(
    conn,
    source_id: str,
    target_id: str,
    relation_type: str,
    percentage: float | None = None,
    confidence: float = 0.6,
    polarity: float = 0.0,
    detail: str | None = None,  # Kept for API compatibility but not stored
    valid_start: datetime | None = None,
    valid_end: datetime | None = None
) -> str:
    """
    Create or update an edge in the knowledge graph.
    
    Args:
        conn: PostgreSQL connection
        source_id: Source node UUID
        target_id: Target node UUID
        relation_type: Relationship type
        percentage: Relationship strength (0-100)
        confidence: Confidence in this edge (0-1)
        polarity: Cooperative (+1) vs adversarial (-1)
        detail: Additional context (not stored - kept for API compatibility)
        valid_start: When relationship started (optional)
        valid_end: When relationship ended (optional)
    
    Returns:
        UUID of the edge
    """
    # Check if edge exists
    result = await conn.fetchrow("""
        SELECT id, hit_count, confidence 
        FROM edges 
        WHERE source_id = $1 AND target_id = $2 AND relation_type = $3
    """, source_id, target_id, relation_type)
    
    if result:
        # Edge exists - update it
        edge_id = str(result['id'])
        new_hit_count = result['hit_count'] + 1
        
        # Keep highest confidence
        new_confidence = max(result['confidence'], confidence)
        
        # Calculate traversal weight
        traversal_weight = calculate_traversal_weight(
            percentage,
            new_confidence,
            datetime.now(timezone.utc),
            new_hit_count
        )
        
        await conn.execute("""
            UPDATE edges 
            SET 
                percentage = $1,
                confidence = $2,
                polarity = $3,
                hit_count = $4,
                last_confirmed = NOW(),
                traversal_weight = $5
            WHERE id = $6
        """, percentage, new_confidence, polarity, new_hit_count, traversal_weight, edge_id)
        
        return edge_id
    else:
        # Create new edge
        # Calculate traversal weight for new edge
        traversal_weight = calculate_traversal_weight(
            percentage,
            confidence,
            datetime.now(timezone.utc),
            1
        )
        
        # Add temporal validity if provided
        validity_clause = ""
        validity_params = []
        if valid_start or valid_end:
            start_str = valid_start.isoformat() if valid_start else ""
            end_str = valid_end.isoformat() if valid_end else ""
            validity_clause = ", validity = $8"
            validity_params = [f"[{start_str},{end_str})"]
        
        query = f"""
            INSERT INTO edges (
                source_id, target_id, relation_type, percentage, confidence, 
                polarity, hit_count, last_confirmed, traversal_weight{validity_clause}
            ) VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), $7{', $8' if validity_params else ''})
            RETURNING id
        """
        
        params = [source_id, target_id, relation_type, percentage, confidence, polarity, traversal_weight] + validity_params
        
        result = await conn.fetchrow(query, *params)
        
        if result:
            return str(result['id'])
        
        raise ValueError(f"Failed to create edge: {source_id} -> {target_id}")


async def touch_edge(conn, edge_id: str) -> None:
    """
    Update last_confirmed timestamp on an edge.
    
    Refreshes the freshness weight without changing other properties.
    
    Args:
        conn: PostgreSQL connection
        edge_id: Edge UUID
    """
    # Get current edge data
    result = await conn.fetchrow("""
        SELECT percentage, confidence, hit_count 
        FROM edges 
        WHERE id = $1
    """, edge_id)
    
    if result:
        # Recalculate traversal weight with updated freshness
        traversal_weight = calculate_traversal_weight(
            result['percentage'],
            result['confidence'],
            datetime.now(timezone.utc),
            result['hit_count']
        )
        
        await conn.execute("""
            UPDATE edges 
            SET 
                last_confirmed = NOW(),
                traversal_weight = $1
            WHERE id = $2
        """, traversal_weight, edge_id)
