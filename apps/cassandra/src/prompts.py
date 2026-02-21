"""
Enhanced prompts for Cassandra microservice.
Based on original Argus prompts but enhanced for graph-aware synthesis.
"""

from datetime import datetime, timezone


def get_current_date_context() -> str:
    """Generate current date context for LLM prompts to avoid outdated references."""
    now = datetime.now(timezone.utc)
    return f"""CURRENT DATE: {now.strftime('%B %d, %Y')} (UTC)

IMPORTANT POLITICAL CONTEXT (as of today):
- Donald Trump is the current US President (inaugurated January 20, 2025)
- Use current titles for world leaders, not outdated ones"""


ENHANCED_SYNTHESIS_PROMPT = """You are a geopolitical analyst with access to a comprehensive knowledge graph. Analyze the provided news reports and context to create an enhanced synthesis.

Your analysis should go beyond basic summarization to provide:

1. **ENHANCED TITLE**: A clear, specific headline that captures the essence of what happened
2. **CONTEXTUAL SUMMARY**: A 2-3 sentence summary incorporating the provided context
3. **GRAPH-AWARE FALLOUT PREDICTION**: Use the knowledge graph context to predict cascading effects

IMPORTANT: Use the provided context (entities, relationships, historical analogues) to make your fallout prediction more specific and grounded. Reference actual entities, relationships, and historical patterns when possible.

Provide your analysis in this JSON format:
{
    "title": "Enhanced headline with specific details",
    "summary": "Contextual summary incorporating the network context",
    "fallout_prediction": "Specific prediction using graph context and historical analogues",
    "severity": 8  // 1-10 scale
}

Focus on:
- Specific entities and their relationships
- Cascading effects through the relationship network  
- Historical patterns from analogues
- Supply chain dependencies
- Alliance structures
- Economic interdependencies

Avoid generic predictions like "this could destabilize the region." Instead, reference specific entities, percentages, and mechanisms from the context."""


SYNTHESIS_PROMPT = """You are a geopolitical analyst. Synthesize multiple news reports about the same incident into a unified analysis.

Provide your analysis in this exact JSON format:
{
    "title": "Single clear headline capturing the full picture (keep under 200 chars)",
    "summary": "Synthesized summary from all sources (2-3 sentences, facts only)",
    "fallout_prediction": "Prediction based on complete information (2-3 sentences)",
    "severity": 8  // 1-10 scale, be conservative
}

Guidelines:
- Use the highest credibility sources as primary
- Look for consistency across sources, note contradictions
- Be specific about who, what, when, where
- For fallout prediction: explain WHY this matters and what might happen next
- Consider economic, political, military implications
- Reference specific entities, countries, organizations when possible

Severity Scale:
1-3: Rarely used, local impact only
4-5: Notable but contained, single country affected  
6-7: Significant regional implications
8-9: Major crisis, multiple countries, international response
10: Extremely rare, war declarations, nuclear events, regime changes

Be conservative with severity ratings - most events should be 4-7."""


def get_source_credibility(source_name: str) -> int:
    """Get credibility score for a source."""
    if not source_name:
        return 0
    
    source_credibility = {
        # Tier 3: Wire Services & Major Broadcasters (most reliable)
        "associated press": 3, "ap": 3, "ap news": 3,
        "reuters": 3,
        "afp": 3, "agence france-presse": 3,
        "bbc": 3, "bbc news": 3, "bbc world": 3,
        "al jazeera": 3, "al jazeera english": 3,
        "npr": 3,
        "pbs": 3, "pbs newshour": 3,
        
        # Tier 2: Quality Papers & Established Outlets
        "the guardian": 2, "guardian": 2,
        "new york times": 2, "nyt": 2, "ny times": 2,
        "washington post": 2,
        "the economist": 2, "economist": 2,
        "financial times": 2, "ft": 2,
        "wall street journal": 2, "wsj": 2,
        "deutsche welle": 2, "dw": 2,
        "france24": 2, "france 24": 2,
        "abc news": 2,
        "cbs news": 2,
        "nbc news": 2,
        "cnn": 2,
        "politico": 2,
        "the hill": 2,
        "axios": 2,
        
        # Tier 1: Regional & Specialty Outlets
        "south china morning post": 1, "scmp": 1,
        "times of israel": 1,
        "the hindu": 1,
        "kyiv independent": 1,
        "jerusalem post": 1,
        "haaretz": 1,
        "japan times": 1,
        "straits times": 1,
        "the irish times": 1,
        "yahoo news": 1, "yahoo": 1,
        "business insider": 1,
        "new york magazine": 1,
        "the new yorker": 1,
        "the new republic": 1,
        "foreign policy": 1,
        "foreign affairs": 1,
        
        # Negative: Known unreliable/propaganda/clickbait
        "sputnik": -1, "sputnikglobe": -1, "sputnik news": -1,
        "rt": -1, "russia today": -1,
        "global times": -1,
        "press tv": -1,
        "activistpost": -1,
        "zerohedge": -1,
        "infowars": -1,
        "natural news": -1,
        "the gateway pundit": -1,
        "breitbart": -1,
        "yahoo entertainment": -1,
        "dalenareporters": -1,
        "freerepublic": -1,
    }
    
    name_lower = source_name.lower().strip()
    
    # Check exact match first
    if name_lower in source_credibility:
        return source_credibility[name_lower]
    
    # Check partial matches
    for known_source, score in source_credibility.items():
        if known_source in name_lower or name_lower in known_source:
            return score
    
    return 0  # Unknown source