"""
Entity resolution using two-pass strategy: alias lookup → semantic search.
"""

import re


def normalize_entity_name(name: str) -> str:
    """
    Normalize entity name for matching.
    
    - Lowercase
    - Strip whitespace
    - Remove punctuation
    - Replace spaces with underscores
    
    Args:
        name: Raw entity name
    
    Returns:
        Normalized name
    """
    normalized = name.lower().strip()
    # Remove common punctuation
    normalized = re.sub(r'[.,;:!?()"\']', '', normalized)
    # Replace spaces with underscores
    normalized = normalized.replace(' ', '_')
    # Remove multiple underscores
    normalized = re.sub(r'_+', '_', normalized)
    # Remove leading/trailing underscores
    normalized = normalized.strip('_')
    return normalized


async def fast_alias_lookup(conn, name: str, entity_type: str) -> str | None:
    """
    Pass 1: Fast exact alias match.
    
    Check entity_aliases table for exact match.
    
    Args:
        conn: PostgreSQL connection
        name: Entity name to resolve
        entity_type: Entity type
    
    Returns:
        Canonical entity UUID if found, None otherwise
    """
    normalized = normalize_entity_name(name)
    
    result = await conn.fetchrow("""
        SELECT ea.canonical_id 
        FROM entity_aliases ea
        JOIN nodes n ON ea.canonical_id = n.id
        WHERE ea.alias = $1 AND n.node_type = $2
    """, normalized, entity_type)
    
    if result:
        return str(result['canonical_id'])
    
    return None


async def semantic_search(
    conn,
    embedding: list[float],
    entity_type: str,
    min_similarity: float = 0.85
) -> tuple[str, str, float] | None:
    """
    Pass 2: Semantic similarity search using embeddings.
    
    Find the closest entity by embedding similarity.
    
    Args:
        conn: PostgreSQL connection
        embedding: Query embedding
        entity_type: Entity type to filter
        min_similarity: Minimum similarity threshold
    
    Returns:
        Tuple of (id, name, similarity) if match found, None otherwise
    """
    # Use pgvector cosine similarity search directly
    # Note: 1 - (embedding <=> query) gives similarity
    result = await conn.fetchrow("""
        SELECT 
            id, 
            name, 
            1 - (embedding <=> $1::vector) as similarity
        FROM nodes 
        WHERE node_type = $2 
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $3
        ORDER BY embedding <=> $1::vector
        LIMIT 1
    """, embedding, entity_type, min_similarity)
    
    if result:
        return (str(result['id']), result['name'], float(result['similarity']))
    
    return None


async def add_alias(conn, alias: str, canonical_id: str) -> bool:
    """
    Add a new alias mapping to the entity_aliases table.
    
    Handles race conditions gracefully - if alias already exists,
    returns False without raising an error.
    
    Args:
        conn: PostgreSQL connection
        alias: Alias name (will be normalized)
        canonical_id: UUID of canonical entity
    
    Returns:
        True if alias was added, False if it already existed
    """
    normalized = normalize_entity_name(alias)
    
    try:
        await conn.execute("""
            INSERT INTO entity_aliases (alias, canonical_id)
            VALUES ($1, $2)
        """, normalized, canonical_id)
        return True
    except Exception as e:
        # Handle duplicate key constraint (race condition)
        error_msg = str(e)
        if "23505" in error_msg or "duplicate key" in error_msg.lower():
            return False
        raise


async def create_entity(
    conn,
    name: str,
    entity_type: str,
    embedding: list[float]
) -> str:
    """
    Create a new entity node.
    
    Args:
        conn: PostgreSQL connection
        name: Entity name
        entity_type: Entity type
        embedding: Entity embedding vector
    
    Returns:
        UUID of created entity
    """
    result = await conn.fetchrow("""
        INSERT INTO nodes (name, node_type, embedding, is_hub)
        VALUES ($1, $2, $3, false)
        RETURNING id
    """, name, entity_type, embedding)
    
    if result:
        return str(result['id'])
    
    raise ValueError(f"Failed to create entity: {name}")


async def resolve_entity(
    conn,
    name: str,
    entity_type: str,
    embedding: list[float] | None = None,
    auto_merge_threshold: float = 0.92,
    review_threshold: float = 0.85
) -> str:
    """
    Resolve entity name to canonical UUID using two-pass strategy.
    
    Pass 1: Fast exact alias match
    Pass 2: Semantic similarity search (if embedding provided)
    
    Handles race conditions gracefully - if another process creates the
    entity while we're resolving, we'll find it on retry.
    
    Args:
        conn: PostgreSQL connection
        name: Entity name to resolve
        entity_type: Entity type
        embedding: Optional embedding for semantic search
        auto_merge_threshold: Similarity threshold for auto-merge
        review_threshold: Similarity threshold for review queue
    
    Returns:
        UUID of canonical entity (existing or newly created)
    """
    # Pass 1: Alias lookup
    alias_match = await fast_alias_lookup(conn, name, entity_type)
    if alias_match:
        return alias_match
    
    # Pass 2: Semantic search (if we have an embedding)
    if embedding:
        semantic_match = await semantic_search(conn, embedding, entity_type, review_threshold)
        
        if semantic_match:
            entity_id, entity_name, similarity = semantic_match
            
            # Auto-merge if similarity is very high
            if similarity >= auto_merge_threshold:
                # Add alias for future fast lookups (ignore if already exists)
                await add_alias(conn, name, entity_id)
                print(f"      ✓ Merged '{name}' → '{entity_name}' (similarity: {similarity:.3f})")
                return entity_id
            
            # Queue for review if similarity is moderate
            if similarity >= review_threshold:
                print(f"      ? '{name}' similar to '{entity_name}' (similarity: {similarity:.3f}) - needs review")
                # For now, create new entity (can merge later after review)
                # TODO: Add to review queue
    
    # Try to create new entity
    try:
        new_id = await create_entity(conn, name, entity_type, embedding or [])
    except Exception as e:
        # If creation failed, another process may have created it - retry alias lookup
        error_msg = str(e)
        if "23505" in error_msg or "duplicate" in error_msg.lower():
            alias_match = await fast_alias_lookup(conn, name, entity_type)
            if alias_match:
                return alias_match
        raise
    
    # Add self-alias for future lookups
    alias_added = await add_alias(conn, name, new_id)
    
    if not alias_added:
        # Alias already exists (race condition) - another process created entity first
        # Look up the existing canonical entity
        existing_id = await fast_alias_lookup(conn, name, entity_type)
        if existing_id:
            # Our new entity is orphaned - this is rare but we return the canonical one
            # The orphaned node will be cleaned up later or merged
            return existing_id
    
    print(f"      + Created new entity: '{name}' ({entity_type})")
    return new_id
