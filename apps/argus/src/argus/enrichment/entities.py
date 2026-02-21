"""
Entity and relationship extraction from articles using OpenRouter.
"""

import asyncio
from ..models.entities import EntityExtractionResult, ExtractedEntity, ExtractedRelationship
from .prompts import ENRICHMENT_WITH_ENTITIES_PROMPT, get_current_date_context


async def extract_entities_and_relationships(
    client,
    article: dict,
    model: str,
    max_retries: int = 2
) -> EntityExtractionResult | None:
    """
    Extract entities and relationships from an article using LLM.
    
    This runs as part of the enrichment call, adding minimal latency.
    
    Args:
        client: Gemini client wrapper
        article: Article dict with title, description, content
        model: Model name to use
        max_retries: Number of retries on failure
    
    Returns:
        EntityExtractionResult or None on failure
    """
    title = article.get("title", "")
    description = article.get("description", "")
    content = article.get("content", "")
    
    # Combine available text
    article_text = f"Title: {title}\nDescription: {description}"
    if content:
        article_text += f"\nContent: {content[:500]}"
    
    for attempt in range(max_retries):
        try:
            date_context = get_current_date_context()
            response_text = await client.generate_content(
                f"{date_context}\n\n{ENRICHMENT_WITH_ENTITIES_PROMPT}\n\nArticle:\n{article_text}",
                model=model,
                response_format={"type": "json_object"}
            )
            
            if response_text:
                import json
                response_data = json.loads(response_text)
                
                # Convert to EntityExtractionResult format
                entities = [
                    ExtractedEntity(
                        name=e.get("name", ""),
                        type=e.get("type", "entity"),
                        canonical_id=e.get("canonical_id"),
                        role=e.get("role", "mentioned")
                    ) for e in response_data.get("entities", [])
                ]
                
                relationships = [
                    ExtractedRelationship(
                        from_entity=r.get("from_entity", ""),
                        to_entity=r.get("to_entity", ""),
                        rel_type=r.get("rel_type", "related"),
                        percentage=r.get("percentage"),
                        detail=r.get("detail"),
                        polarity=r.get("polarity", 0.0)
                    ) for r in response_data.get("relationships", [])
                ]
                
                return EntityExtractionResult(
                    entities=entities,
                    relationships=relationships
                )
        
        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
            print(f"      ⚠️ Entity extraction failed: {type(e).__name__}")
    
    return None


def validate_entities(entities: list[ExtractedEntity]) -> list[ExtractedEntity]:
    """
    Validate and clean extracted entities.
    
    - Remove empty names
    - Remove duplicates
    - Normalize canonical IDs
    
    Args:
        entities: List of extracted entities
    
    Returns:
        Cleaned list of entities
    """
    from graph.resolution import normalize_entity_name
    
    seen_names = set()
    valid_entities = []
    
    for entity in entities:
        # Skip empty names
        if not entity.name or not entity.name.strip():
            continue
        
        # Generate canonical ID if not set
        if not entity.canonical_id:
            entity.canonical_id = normalize_entity_name(entity.name)
        
        # Skip duplicates (by canonical ID)
        if entity.canonical_id in seen_names:
            continue
        
        seen_names.add(entity.canonical_id)
        valid_entities.append(entity)
    
    return valid_entities


def validate_relationships(
    relationships: list[ExtractedRelationship],
    valid_entity_names: set[str]
) -> list[ExtractedRelationship]:
    """
    Validate and clean extracted relationships.
    
    - Ensure both entities exist
    - Remove self-loops
    - Remove duplicates
    
    Args:
        relationships: List of extracted relationships
        valid_entity_names: Set of valid entity names from extraction
    
    Returns:
        Cleaned list of relationships
    """
    seen_relationships = set()
    valid_relationships = []
    
    for rel in relationships:
        # Skip if entities don't exist
        if rel.from_entity not in valid_entity_names or rel.to_entity not in valid_entity_names:
            continue
        
        # Skip self-loops
        if rel.from_entity == rel.to_entity:
            continue
        
        # Create unique key for deduplication
        rel_key = (rel.from_entity, rel.to_entity, rel.rel_type)
        if rel_key in seen_relationships:
            continue
        
        seen_relationships.add(rel_key)
        valid_relationships.append(rel)
    
    return valid_relationships
