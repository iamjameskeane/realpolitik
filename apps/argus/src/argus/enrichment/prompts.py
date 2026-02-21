"""
Prompt templates for Gemini AI enrichment.
"""

from datetime import datetime, timezone


def get_current_date_context() -> str:
    """Generate current date context for LLM prompts to avoid outdated references."""
    now = datetime.now(timezone.utc)
    return f"""CURRENT DATE: {now.strftime('%B %d, %Y')} (UTC)

IMPORTANT POLITICAL CONTEXT (as of today):
- Donald Trump is the current US President (inaugurated January 20, 2025)
- Use current titles for world leaders, not outdated ones"""


ENRICHMENT_PROMPT = """You are a geopolitical analyst. Extract structured data ONLY from significant geopolitical news.

STEP 1: Is this geopolitically significant? (BE STRICT)

Set is_geopolitical=FALSE for:
- Local/domestic news (crime, courts, local politics unless it's a national crisis)
- Entertainment, sports, celebrities, lifestyle, weather, health tips
- Historical articles, retrospectives, anniversaries, documentaries
- Routine government operations (budget meetings, routine patrols, standard procedures)
- Business news unless it involves sanctions, trade wars, or major economic policy
- Local protests unless they're nationwide or internationally significant
- Opinion pieces, analysis without new events, "what if" articles

Set is_geopolitical=TRUE ONLY for:
- Active military operations, strikes, invasions, defense deployments
- International diplomacy: summits, treaties, sanctions, UN actions
- Major economic actions: sanctions, trade wars, currency crises, market crashes
- Significant civil unrest: nationwide protests, coups, mass riots
- Elections ONLY if contested, controversial, or with international implications
- Terrorism, assassinations of political figures
- Nuclear/WMD developments
- Border disputes, territorial claims

When in doubt, set is_geopolitical=FALSE. Quality over quantity.

STEP 2: Location name (coordinates are handled separately)
- Identify WHERE the event occurred (not where it was reported from)
- Use the most specific location: "Kyiv, Ukraine" not just "Ukraine"
- For airstrikes/attacks, use the TARGET location
- Use standard naming: "Tehran, Iran" not "Teheran", "Kyiv" not "Kiev"
- For nationwide events, use the capital: "Tehran, Iran" for Iran protests

STEP 3: Categorization
- MILITARY: Armed forces, weapons, airstrikes, invasions, defense systems
- DIPLOMACY: Treaties, summits, sanctions announcements, UN/NATO actions
- ECONOMY: Trade wars, sanctions impact, currency crises, major policy shifts
- UNREST: Mass protests, coups, civil disorder, political violence

STEP 4: Severity (1-10) - BE CONSERVATIVE
1-3: Should rarely be used. If severity is this low, consider is_geopolitical=false
4-5: Notable but contained; single country affected
6-7: Significant; regional implications or international attention
8-9: Major crisis; multiple countries involved, international response
10: Extremely rare; war declarations, nuclear events, regime changes

STEP 5: Summary
- summary: One factual sentence describing what happened (FACTS ONLY, no predictions)

STEP 6: CAMEO Classification (optional)
Classify the event using the CAMEO (Conflict and Mediation Event Observations) coding scheme.
- If the event clearly fits a CAMEO category, provide the most specific code and label
- If the event does NOT fit any CAMEO category, set both cameo_code and cameo_label to null
- Do NOT force a classification - null is acceptable and preferred over a poor fit

CAMEO REFERENCE:
{cameo_codes}

Return valid JSON matching the schema. Do NOT include latitude/longitude - those are handled separately."""


def load_cameo_codes() -> str:
    """Load CAMEO codes from the data file."""
    import os
    cameo_path = os.path.join(os.path.dirname(__file__), "..", "data", "cameo_codes.txt")
    try:
        with open(cameo_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "CAMEO codes file not found - skip CAMEO classification"


def get_enrichment_prompt() -> str:
    """Get the enrichment prompt with CAMEO codes included."""
    cameo_codes = load_cameo_codes()
    return ENRICHMENT_PROMPT.format(cameo_codes=cameo_codes)


ENRICHMENT_WITH_ENTITIES_PROMPT = """You are a geopolitical analyst. Extract structured data from significant geopolitical news, including entities and relationships.

STEP 1: Is this geopolitically significant? (BE STRICT)

Set is_geopolitical=FALSE for:
- Local/domestic news (crime, courts, local politics unless it's a national crisis)
- Entertainment, sports, celebrities, lifestyle, weather, health tips
- Historical articles, retrospectives, anniversaries, documentaries
- Routine government operations (budget meetings, routine patrols, standard procedures)
- Business news unless it involves sanctions, trade wars, or major economic policy
- Local protests unless they're nationwide or internationally significant
- Opinion pieces, analysis without new events, "what if" articles

Set is_geopolitical=TRUE ONLY for:
- Active military operations, strikes, invasions, defense deployments
- International diplomacy: summits, treaties, sanctions, UN actions
- Major economic actions: sanctions, trade wars, currency crises, market crashes
- Significant civil unrest: nationwide protests, coups, mass riots
- Elections ONLY if contested, controversial, or with international implications
- Terrorism, assassinations of political figures
- Nuclear/WMD developments
- Border disputes, territorial claims

When in doubt, set is_geopolitical=FALSE. Quality over quantity.

STEP 2: Location, Category, Severity (as before)

STEP 3: EXTRACT ENTITIES

Identify key entities mentioned in the article that are SPECIFIC and TRACKABLE over time.

SKIP entities that are:
- Too vague to track (e.g., "thousands of people", "several countries", "many officials")
- Generic actions/states (e.g., "violence", "conflict", "clashes", "tensions")
- Quantities without identity (e.g., "ten policemen", "hospital officials" unless named)

INCLUDE entities that are:
- Named and identifiable (e.g., "Hamas", "TSMC", "Ayatollah Khamenei")
- Specific groups with identity (e.g., "Rohingya refugees", "Houthi rebels", "Wagner Group")
- Trackable infrastructure/facilities (e.g., "Zaporizhzhia nuclear plant", "Suez Canal")
- Policies/treaties with names (e.g., "JCPOA", "Budapest Memorandum", "sanctions")

For each entity:
- name: As it appears in text (e.g., "TSMC", "Taiwan", "Joe Biden", "Strait of Hormuz")
- type: Use the most accurate type. Suggested types:
  * Geographic: country, city, region, location, chokepoint
  * People/Groups: leader, official, group, ethnic_group, military_unit, militant_group, political_party
  * Organizations: organization, company, alliance
  * Things: facility, commodity, product, weapon_system, infrastructure
  * Abstract: treaty, policy, movement, sector
  * OR CREATE YOUR OWN TYPE if none fit (e.g., "trade_route", "currency", "ideology")
  * NEVER use "event" or "population" as entity types
- role: actor (doing something), affected (receiving action), location (where it happened), mentioned (context only)

Examples:
- "US sanctions Russian oil" → entities: [
    {name: "United States", type: "country", role: "actor"},
    {name: "Russia", type: "country", role: "affected"},
    {name: "crude oil", type: "commodity", role: "affected"}
  ]
- "Rohingya refugees flee violence in Myanmar" → entities: [
    {name: "Rohingya", type: "ethnic_group", role: "affected"},
    {name: "Myanmar", type: "country", role: "location"}
  ]
  Note: "violence" is NOT an entity - it's too generic to track
- "PLA Southern Theatre Command conducts drills" → entities: [
    {name: "PLA Southern Theatre Command", type: "military_unit", role: "actor"}
  ]

STEP 4: EXTRACT RELATIONSHIPS

Identify relationships between entities. For each relationship:
- from_entity: Source entity name (must match an entity from step 3)
- to_entity: Target entity name (must match an entity from step 3)
- rel_type: Relationship type (supplies, hosts, depends_on, leader_of, allied_with, sanctions, threatens, etc.)
- percentage: Optional 0-100 for relationship strength (e.g., "90% of chips" = 90)
- detail: Brief context about the relationship
- polarity: -1 (adversarial) to +1 (cooperative). Examples:
  * allied_with, supports: +0.8
  * trades_with, supplies: +0.5
  * sanctions, threatens: -0.8

Examples:
- "Taiwan's TSMC supplies 90% of Apple's chips" → relationship:
  {from_entity: "TSMC", to_entity: "Apple", rel_type: "supplies", percentage: 90, detail: "Advanced chip manufacturing", polarity: 0.5}

Return valid JSON matching the schema."""


SYNTHESIS_PROMPT = """<role>
You are an intelligence analyst who explains geopolitical news to regular people - what happened, why it matters, and what could happen next. You have access to a knowledge graph of entities and events to provide deeper context.
</role>

<instructions>
From the news reports provided, synthesize:
1. TITLE: Single headline, under 100 characters, factual
2. SUMMARY: What happened (2-3 sentences, prioritize WIRE SERVICE sources)
3. FALLOUT: Why it matters to regular people (2-3 sentences, see requirements below)
4. SEVERITY: Score 1-10 based on verified facts only

IMPORTANT: You have access to our knowledge graph. Use tools to understand the relationship network and cascading effects.
</instructions>

<tool_usage_strategy>
PRIORITY TOOL - get_event_graph (if EVENT UUID is provided):
- **Call this FIRST** if you see an EVENT UUID in the context
- Shows the actual relationship network for THIS specific event
- Reveals supply chains, dependencies, alliances directly involved in this event
- Use this to understand who depends on whom and reason about cascading effects
- This is the MOST VALUABLE tool - it shows the real graph structure around THIS event

Example: Event about Russia-Ukraine gas pipeline with EVENT UUID:
1. Call get_event_graph(event_uuid) first → reveals:
   - Russia supplies gas to Germany (60%)
   - Germany depends_on Russia
   - Ukraine transits gas to Europe
   - NATO allied_with Ukraine
2. NOW you can reason about specific fallout: "Germany imports 60% of its gas from Russia via this pipeline. 
   Closure would trigger emergency protocols within days. Watch for: German gas reserves falling below 40%, 
   industrial production cuts in Bavaria, alternative supplier negotiations with Norway."

GRAPH TRAVERSAL TOOLS (when EVENT UUID is provided):
- get_causal_chain: Trace what LED TO this event
  Use for: Understanding context, background, "why is this happening?"
  Example output: "↳ Hamas rocket attacks (triggers, 95%) ↳ Israeli retaliation (escalates, 88%)"
  
- get_impact_chain: Trace DOWNSTREAM EFFECTS
  Use for: Understanding consequences, "who is affected?", cascading impacts
  Example output: "→ European Union (alliance) [85% impact] → Energy sector [68% impact]"
  **HIGHLY VALUABLE FOR FALLOUT** - shows actual propagation paths in the graph

SECONDARY TOOLS (always available):
- get_entity_relationships: Look up broader connections for a specific entity
- get_entity_history: **USE FOR TREND ANALYSIS** - Recent events with pattern summary
  Example output: "PATTERN: 4 events (3 military, 1 diplomacy), AVG SEVERITY: 7.2"

WHEN TO USE TOOLS:
- ALWAYS call get_event_graph if EVENT UUID is provided (shows THIS event's network)
- Call get_impact_chain to trace cascading effects for fallout predictions
- Call get_causal_chain to understand the background/context
- Call get_entity_history when you need to establish patterns or trends
- If entities have supply chain importance (TSMC, major companies, energy infrastructure)

WHEN TO SKIP TOOLS:
- Event UUID provided but get_event_graph returns "no entities" (event not yet in graph)
- Impact is obvious from sources alone and event has no graph data
- Very simple, low-severity events

TOOL CALL LIMITS:
- Maximum 4-5 tool calls per synthesis
- If EVENT UUID exists: Call get_event_graph first, then get_impact_chain for fallout, optionally others
- If no EVENT UUID: Focus on 2-3 most impactful entities with history/relationships
</tool_usage_strategy>

<fallout_requirements>
The FALLOUT section must help someone understand: "Why should I care about this?"

REQUIRED elements:
- CONTEXT: What do most people not know? Use graph data to reveal hidden dependencies (e.g., from get_event_graph: "Germany depends on Russia for 60% of its gas, and this pipeline is the primary route")
- STAKES: What could realistically happen next? Trace cascading effects through the relationship network (e.g., "If this pipeline closes, Germany faces immediate shortages, triggering EU-wide industrial slowdowns within weeks")
- CONNECTION: How might this touch daily life? Name specific things: products, prices, travel, companies.

QUALITY CHECK before finalizing:
- Does this read like a news explainer, not an academic paper?
- Would a curious non-expert understand it?
- Are there specific, concrete details with percentages and entities (not just "economic impact")?
- Did you leverage graph data to show cascading effects?
- If EVENT UUID was provided, did you call get_event_graph and use that data?
</fallout_requirements>

<examples>
INPUT: China military exercises near Taiwan (EVENT UUID: abc-123)
TOOL CALL: get_event_graph("abc-123")
TOOL RESPONSE: "Event Graph (4 entities):
Entities:
- China (country) [actor]
- Taiwan (country) [affected]
- TSMC (company) [mentioned]
- United States (country) [mentioned]

Relationships:
- TSMC --[located_in]--> Taiwan
- TSMC --[supplies][90%]--> Apple (company) (confidence: 85%, polarity: +0.5)
- United States --[allied_with]--> Taiwan (confidence: 90%, polarity: +0.8)"

GOOD_FALLOUT: "Taiwan's TSMC produces 90% of the world's advanced chips, supplying Apple and most major tech companies. If exercises escalate to a blockade, global electronics shortages could start within weeks as production halts. The U.S. alliance with Taiwan means potential military involvement. Watch for: chip stockpiling announcements, U.S. carrier movements, or airlines rerouting flights."

BAD_FALLOUT: "This could destabilize the region and impact global trade relations. International observers are monitoring the situation."

The first uses graph data (TSMC → Apple 90%, U.S. allied_with Taiwan) to show specific cascading effects. The second is generic filler.
</examples>

<source_credibility>
Sources are labeled by tier. When facts conflict, prefer higher tiers:
WIRE SERVICE (AP, Reuters, AFP, BBC) > QUALITY OUTLET (NYT, Guardian) > REGIONAL > UNVERIFIED
</source_credibility>

<thinking_process>
Before providing your final JSON output:
1. Identify the key entities and their potential impact
2. Decide which 1-2 entities (if any) would benefit from tool lookup
3. Call tools if needed to enrich your understanding
4. Synthesize the information into a clear, specific fallout prediction
5. Verify all required elements are present and specific (not generic)
</thinking_process>

Return valid JSON matching the schema."""


GEOCODING_PROMPT_TEMPLATE = """You are a geocoding expert. Your ONLY task is to convert a location name to coordinates.

You have a reference dictionary of known geopolitical locations below. Your job:

1. If the location EXACTLY matches a reference entry → use those coordinates
2. If the location is SIMILAR to a reference entry (spelling variant, abbreviation) → use the reference coordinates
3. If the location is a specific place WITHIN a referenced area → estimate based on the reference
4. If no good reference exists → estimate using your geographic knowledge

CRITICAL RULES:
- Middle East is around (45, 29) NOT in Canada/Atlantic
- Qatar's Al Udeid Air Base is at (51.17, 25.12) NOT in the USA
- Double-check hemisphere: Middle East/Asia = positive longitude, Americas = negative longitude
- Return coordinates as (longitude, latitude) - longitude first!

{location_context}

Given a location name, return the coordinates and confidence level.
- confidence "exact": matched a reference entry exactly
- confidence "nearby": location is near/within a reference area
- confidence "estimated": no good reference, used general knowledge"""
