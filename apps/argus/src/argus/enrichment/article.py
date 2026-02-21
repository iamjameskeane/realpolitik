"""
Article enrichment using OpenRouter AI.
"""

import asyncio
import sys
from ..models.articles import EnrichedArticle, GeminiEnrichmentResponse
from .prompts import get_enrichment_prompt, get_current_date_context


async def enrich_article(
    client,
    article: dict,
    index: int,
    total: int,
    model: str,
    config = None,
    max_retries: int = 3,
) -> tuple[dict, EnrichedArticle | None]:
    """
    Use OpenRouter to extract structured geopolitical data from an article.
    Returns tuple of (original_article, enriched_data or None).
    
    Uses the lighter model for cost efficiency on high-volume enrichment.
    Includes retry logic for rate limits with exponential backoff.
    
    Args:
        client: OpenRouter client wrapper
        article: Raw article dict
        index: Article index (for logging)
        total: Total articles (for logging)
        model: Model name to use
        max_retries: Number of retries on failure
    
    Returns:
        Tuple of (original article, EnrichedArticle or None)
    """
    title = article.get("title", "")
    description = article.get("description", "")
    content = article.get("content", "")
    
    # Combine available text
    article_text = f"Title: {title}\nDescription: {description}"
    if content:
        article_text += f"\nContent: {content[:500]}"
    
    last_error = None
    for attempt in range(max_retries):
        try:
            # Use OpenRouter with JSON response for structured output
            date_context = get_current_date_context()
            enrichment_prompt = get_enrichment_prompt()
            response_text = await client.generate_content(
                f"{date_context}\n\n{enrichment_prompt}\n\nArticle:\n{article_text}",
                model=model,
                response_format={"type": "json_object"}
            )
            
            if not response_text:
                print(f"  ⚠️ [{index+1}/{total}] Empty response: {title[:40]}...")
                return (article, None)
            
            # Parse JSON response into the expected structure
            import json
            response_data = json.loads(response_text)
            
            # Handle the response format from OpenRouter
            # Convert to EnrichedArticle structure
            enriched = EnrichedArticle(
                location_name=response_data.get("location_name", ""),
                category=response_data.get("category", "UNREST"),
                severity=response_data.get("severity", 1),
                summary=response_data.get("summary", ""),
                is_geopolitical=response_data.get("is_geopolitical", False),
                cameo_code=response_data.get("cameo_code"),
                cameo_label=response_data.get("cameo_label"),
            )
            
            # Extract entities and relationships if enabled
            if config and config.enable_entities and enriched.is_geopolitical:
                from .entities import extract_entities_and_relationships
                entity_result = await extract_entities_and_relationships(
                    client, article, model, max_retries=2
                )
                if entity_result:
                    enriched.entities = [e.model_dump() for e in entity_result.entities]
                    enriched.relationships = [r.model_dump() for r in entity_result.relationships]
            
            if enriched.is_geopolitical:
                print(f"  ✓ [{index+1}/{total}] {enriched.category} | {title[:50]}...")
            else:
                print(f"  ↳ [{index+1}/{total}] Skipped: {title[:50]}...")
            
            return (article, enriched)
            
        except Exception as e:
            last_error = e
            error_msg = str(e).lower()
            
            # Check for quota/rate limit errors
            if "quota" in error_msg or "resource_exhausted" in error_msg or "429" in str(e):
                wait_time = (2 ** attempt) * 5  # 5s, 10s, 20s
                print(f"  ⏳ [{index+1}/{total}] Rate limited, waiting {wait_time}s... (attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(wait_time)
                continue
            
            # JSON parsing errors - likely malformed response
            if "validation" in error_msg or "json" in error_msg:
                if attempt < max_retries - 1:
                    print(f"  ⚠️ [{index+1}/{total}] Parse error, retrying: {type(e).__name__}")
                    await asyncio.sleep(1)
                    continue
            
            # Other errors
            if attempt < max_retries - 1:
                print(f"  ⚠️ [{index+1}/{total}] API error, retrying: {type(e).__name__}")
                await asyncio.sleep(2)
                continue
            
            error_detail = str(e)[:150] if str(e) else "No details"
            print(f"  ⚠️ [{index+1}/{total}] Failed: {title[:40]}... ({type(e).__name__})")
            print(f"      Error: {error_detail}")
            return (article, None)
    
    # All retries exhausted
    print(f"  ❌ [{index+1}/{total}] Rate limit exceeded after {max_retries} retries")
    return (article, None)
