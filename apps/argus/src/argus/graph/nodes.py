"""
Node operations for the knowledge graph using direct PostgreSQL (Atlas).
"""


async def upsert_node(
    conn,
    name: str,
    node_type: str,
    embedding: list[float],
    is_hub: bool = False
) -> str:
    """
    Create or update a node in the knowledge graph.
    
    Args:
        conn: PostgreSQL connection
        name: Node name
        node_type: Node type (entity type)
        embedding: Node embedding vector
        is_hub: Whether this is a high-degree hub node
    
    Returns:
        UUID of the node
    """
    # Try to find existing node first
    result = await conn.fetchrow("""
        SELECT id FROM nodes 
        WHERE name = $1 AND node_type = $2
    """, name, node_type)
    
    if result:
        # Update existing
        node_id = result['id']
        await conn.execute("""
            UPDATE nodes 
            SET 
                embedding = $1,
                is_hub = $2,
                updated_at = NOW()
            WHERE id = $3
        """, embedding, is_hub, node_id)
        return str(node_id)
    else:
        # Create new
        result = await conn.fetchrow("""
            INSERT INTO nodes (name, node_type, embedding, is_hub)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        """, name, node_type, embedding, is_hub)
        
        if result:
            return str(result['id'])
        
        raise ValueError(f"Failed to create node: {name}")


async def link_event_to_entities(
    conn,
    event_id: str,
    entity_ids: list[str],
    roles: list[str]
) -> None:
    """
    Link an event to its extracted entities using edges.
    
    Uses graph edges instead of a junction table - more graph-native approach.
    Role determines the relation_type:
    - 'actor' -> 'involves'
    - 'affected' -> 'affects'
    - 'location' -> 'occurred_in'
    - 'mentioned' -> 'mentions'
    
    Args:
        conn: PostgreSQL connection
        event_id: Event UUID (the event node's ID)
        entity_ids: List of entity UUIDs
        roles: List of roles (same length as entity_ids)
    """
    if len(entity_ids) != len(roles):
        raise ValueError("entity_ids and roles must have same length")
    
    # Map roles to relation types
    role_to_relation = {
        "actor": "involves",
        "affected": "affects",
        "location": "occurred_in",
        "mentioned": "mentions"
    }
    
    from .edges import upsert_edge
    
    for entity_id, role in zip(entity_ids, roles):
        relation_type = role_to_relation.get(role, "involves")
        await upsert_edge(
            conn,
            source_id=event_id,
            target_id=entity_id,
            relation_type=relation_type,
            confidence=0.6  # LLM-extracted
        )


async def get_event_node(
    conn,
    event_id: str
) -> str | None:
    """
    Get an existing event node by its ID.
    
    In Atlas, events ARE nodes - the event's UUID is the node's UUID.
    This just verifies the event exists as a node.
    
    Args:
        conn: PostgreSQL connection
        event_id: Event UUID (same as node ID)
    
    Returns:
        Event node UUID if found, None otherwise
    """
    # Events are nodes where node_type = 'event' and id = event_id
    result = await conn.fetchrow("""
        SELECT id FROM nodes 
        WHERE id = $1 AND node_type = 'event'
    """, event_id)
    
    if result:
        return str(result['id'])
    
    return None


async def update_event_embedding(
    conn,
    event_id: str,
    embedding: list[float]
) -> None:
    """
    Update embedding for an existing event node.
    
    Args:
        conn: PostgreSQL connection
        event_id: Event UUID (same as node ID)
        embedding: Event embedding vector
    """
    await conn.execute("""
        UPDATE nodes 
        SET 
            embedding = $1,
            updated_at = NOW()
        WHERE id = $2 AND node_type = 'event'
    """, embedding, event_id)
