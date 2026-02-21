"""
Simplified multi-source synthesis for incident consolidation using OpenRouter.
This is a simplified version without tool calling - tool calling will be added back later.
"""

import asyncio
import json
from ..models.events import EventSource, SynthesizedEvent
from ..config import get_source_credibility
from .prompts import SYNTHESIS_PROMPT, get_current_date_context


def get_credibility_label(credibility: int) -> str:
    """Get human-readable credibility label."""
    if credibility >= 8:
        return "HIGH"
    elif credibility >= 6:
        return "MEDIUM"
    elif credibility >= 4:
        return "LOW"
    else:
        return "VERY LOW"


async def synthesize_incident(
    client,
    sources: list[EventSource],
    model: str,
    location_name: str = "",
    entities: list[dict] | None = None,
) -> SynthesizedEvent | None:
    """
    Synthesize a unified event from multiple sources about the same incident.
    Simplified version using OpenRouter without tool calling.
    
    Args:
        client: OpenRouter client wrapper
        sources: List of event sources to synthesize
        model: Model name to use
        location_name: Location for logging
        entities: Optional list of entities extracted from enrichment
    
    Returns:
        SynthesizedEvent or None on failure
    """
    
    # Sort by credibility (highest first), then by timestamp (earliest first for tie-breaking)
    def source_sort_key(s: EventSource) -> tuple[int, str]:
        cred = get_source_credibility(s.source_name)
        return (-cred, s.timestamp)  # Negative credibility so higher sorts first
    
    sorted_sources = sorted(sources, key=source_sort_key)
    
    # Build the timeline with credibility labels
    timeline_parts = []
    for i, s in enumerate(sorted_sources):
        cred = get_source_credibility(s.source_name)
        label = get_credibility_label(cred)
        timeline_parts.append(
            f"{i+1}. [{s.source_name}] ({label}) {s.timestamp}\n   Headline: {s.headline}\n   Summary: {s.summary}"
        )
    timeline = "\n".join(timeline_parts)
    
    # Build entity context if available
    entity_context = ""
    if entities:
        entity_names = [e.get("name", "") for e in entities if e.get("name")]
        if entity_names:
            entity_context = f"\n\nENTITIES INVOLVED: {', '.join(entity_names)}"
    
    try:
        # Include current date context to avoid outdated political references
        date_context = get_current_date_context()
        
        initial_prompt = f"{date_context}\n\n{SYNTHESIS_PROMPT}\n\nNews reports about the same incident:\n\n{timeline}{entity_context}"
        
        # Call OpenRouter for synthesis
        response_text = await client.generate_content(
            initial_prompt,
            model=model,
            response_format={"type": "json_object"}
        )
        
        if not response_text:
            print(f"   ⚠️ Empty synthesis response for {location_name}")
            return None
        
        # Parse JSON response
        try:
            response_data = json.loads(response_text)
            
            # Map response to SynthesizedEvent
            synthesized = SynthesizedEvent(
                title=response_data.get("title", "Untitled Event"),
                summary=response_data.get("summary", "No summary available"),
                fallout_prediction=response_data.get("fallout_prediction", "No fallout prediction available"),
                severity=response_data.get("severity", 5)
            )
            
            # Log success
            print(f"  ✓ Synthesized: {location_name} ({len(sources)} sources)")
            
            return synthesized
            
        except (json.JSONDecodeError, KeyError) as e:
            print(f"   ⚠️ Failed to parse synthesis response for {location_name}: {e}")
            return None
            
    except Exception as e:
        print(f"   ⚠️ Synthesis failed for {location_name}: {type(e).__name__}: {e}")
        return None