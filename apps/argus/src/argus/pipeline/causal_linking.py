"""
Symbolic causal linking between events.

Compares new events to recent events and creates causal edges
when there's high confidence of a relationship.
"""

from datetime import datetime, timedelta, timezone


def calculate_relatedness_score(new_event: dict, past_event: dict) -> tuple[float, str]:
    """
    Calculate how related two events are using symbolic rules.
    
    Returns:
        Tuple of (score, inferred_relationship_type)
        Score >= 5.0 suggests strong causal relationship (requires location or entity match)
    """
    score = 0.0
    reasons = []
    
    # 1. Location match (same place = likely related)
    new_location = (new_event.get("location_name") or "").lower().strip()
    past_location = (past_event.get("location_name") or "").lower().strip()
    
    if new_location and past_location:
        if new_location == past_location:
            score += 2.0
            reasons.append("same_location")
        elif new_location in past_location or past_location in new_location:
            score += 1.0
            reasons.append("similar_location")
    
    # 2. Entity overlap (shared actors = likely related)
    new_entities = set(e.get("name", "").lower() for e in new_event.get("entities", []))
    past_entities = set(e.get("name", "").lower() for e in past_event.get("entities", []))
    
    if new_entities and past_entities:
        shared = new_entities & past_entities
        # Weight by number of shared entities
        entity_score = min(len(shared) * 0.75, 3.0)  # Cap at 3.0
        score += entity_score
        if shared:
            reasons.append(f"shared_entities:{len(shared)}")
    
    # 3. Temporal proximity (closer = more likely related)
    new_time = parse_timestamp(new_event.get("timestamp"))
    past_time = parse_timestamp(past_event.get("timestamp"))
    
    if new_time and past_time:
        days_apart = abs((new_time - past_time).days)
        if days_apart <= 1:
            score += 2.0
            reasons.append("within_1_day")
        elif days_apart <= 3:
            score += 1.5
            reasons.append("within_3_days")
        elif days_apart <= 7:
            score += 1.0
            reasons.append("within_7_days")
    
    # 4. Category patterns (escalation/de-escalation)
    new_cat = new_event.get("category", "").upper()
    past_cat = past_event.get("category", "").upper()
    
    escalation_patterns = [
        ("DIPLOMACY", "MILITARY"),   # Talks fail → fighting
        ("DIPLOMACY", "UNREST"),     # Political failure → protests
        ("UNREST", "MILITARY"),      # Protests → crackdown
        ("ECONOMY", "UNREST"),       # Economic crisis → unrest
    ]
    
    de_escalation_patterns = [
        ("MILITARY", "DIPLOMACY"),   # Fighting → peace talks
        ("UNREST", "DIPLOMACY"),     # Protests → negotiations
    ]
    
    if (past_cat, new_cat) in escalation_patterns:
        score += 1.5
        reasons.append("escalation_pattern")
    elif (past_cat, new_cat) in de_escalation_patterns:
        score += 1.5
        reasons.append("de_escalation_pattern")
    elif past_cat == new_cat:
        score += 0.5
        reasons.append("same_category")
    
    # 5. Severity change (significant change suggests continuation)
    new_sev = new_event.get("severity", 5)
    past_sev = past_event.get("severity", 5)
    sev_diff = new_sev - past_sev
    
    if abs(sev_diff) >= 2:
        score += 0.5
        if sev_diff > 0:
            reasons.append("severity_increase")
        else:
            reasons.append("severity_decrease")
    
    # Infer relationship type based on patterns
    relationship = infer_relationship_type(
        past_cat, new_cat, 
        past_sev, new_sev,
        "escalation_pattern" in reasons,
        "de_escalation_pattern" in reasons
    )
    
    return score, relationship


def infer_relationship_type(
    past_cat: str, 
    new_cat: str, 
    past_sev: int, 
    new_sev: int,
    is_escalation: bool,
    is_de_escalation: bool
) -> str:
    """Infer the type of causal relationship based on patterns."""
    
    if is_escalation:
        if new_sev > past_sev:
            return "escalates"
        return "triggers"
    
    if is_de_escalation:
        return "leads_to"
    
    if past_cat == new_cat:
        if new_sev > past_sev:
            return "intensifies"
        elif new_sev < past_sev:
            return "continues"
        return "follows"
    
    return "related_to"


def parse_timestamp(ts) -> datetime | None:
    """Parse timestamp string to datetime."""
    if not ts:
        return None
    if isinstance(ts, datetime):
        return ts
    try:
        # Handle ISO format with timezone
        if isinstance(ts, str):
            ts = ts.replace('Z', '+00:00')
            return datetime.fromisoformat(ts)
    except:
        pass
    return None


async def find_related_events(
    new_event: dict,
    db,
    days_back: int = 7,
    min_score: float = 5.0,
    max_links: int = 3
) -> list[dict]:
    """
    Find past events that are causally related to a new event.
    
    Args:
        new_event: The new event to find relations for
        db: Supabase client
        days_back: How far back to look for related events
        min_score: Minimum score to consider a causal link
        max_links: Maximum number of causal links to create
    
    Returns:
        List of {past_event_id, relationship, score} dicts
    """
    # Get the new event's location and entities for querying
    location = new_event.get("location_name", "")
    entity_names = [e.get("name", "") for e in new_event.get("entities", [])]
    
    # Calculate cutoff date
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    cutoff_str = cutoff.isoformat()
    
    # Query recent events from same region or with overlapping entities
    # We'll get candidates and score them locally
    try:
        # Get recent events (not the current one)
        result = db.table("nodes").select(
            "id, name, created_at"
        ).eq(
            "node_type", "event"
        ).gte(
            "created_at", cutoff_str
        ).neq(
            "id", new_event.get("id")
        ).order(
            "created_at", desc=True
        ).limit(50).execute()
        
        if not result.data:
            return []
        
        # Get details for each candidate event
        candidates = []
        for node in result.data:
            # Get event details
            details = db.table("event_details").select(
                "title, category, severity, location_name"
            ).eq("node_id", node["id"]).execute()
            
            if not details.data:
                continue
            
            detail = details.data[0]
            
            # Get entities for this event
            entities = db.rpc("get_event_entities", {
                "event_uuid": node["id"]
            }).execute()
            
            past_event = {
                "id": node["id"],
                "title": detail.get("title", ""),
                "category": detail.get("category", ""),
                "severity": detail.get("severity", 5),
                "location_name": detail.get("location_name", ""),
                "timestamp": node.get("created_at"),
                "entities": entities.data if entities.data else []
            }
            
            # Calculate score
            score, relationship = calculate_relatedness_score(new_event, past_event)
            
            if score >= min_score:
                candidates.append({
                    "past_event_id": node["id"],
                    "past_event_title": detail.get("title", "")[:50],
                    "relationship": relationship,
                    "score": score
                })
        
        # Sort by score and return top matches
        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates[:max_links]
    
    except Exception as e:
        print(f"   ⚠️ Error finding related events: {e}")
        return []


async def create_causal_edges(
    new_event: dict,
    related_events: list[dict],
    db
) -> int:
    """
    Create event→event edges for causal relationships.
    
    Args:
        new_event: The new event (target of causal edges)
        related_events: List of {past_event_id, relationship, score} dicts
        db: Supabase client
    
    Returns:
        Number of edges created
    """
    edges_created = 0
    
    for rel in related_events:
        try:
            # Check if edge already exists
            existing = db.table("edges").select("id").eq(
                "source_id", rel["past_event_id"]
            ).eq(
                "target_id", new_event["id"]
            ).eq(
                "relation_type", rel["relationship"]
            ).is_("valid_to", "null").execute()
            
            if existing.data:
                # Edge already exists, skip
                continue
            
            # Create edge: past_event → new_event
            # (past event CAUSES/TRIGGERS new event)
            db.table("edges").insert({
                "source_id": rel["past_event_id"],
                "target_id": new_event["id"],
                "relation_type": rel["relationship"],
                "confidence": min(rel["score"] / 5.0, 1.0),  # Normalize score to 0-1
                "source": "llm"  # Mark as LLM-generated
            }).execute()
            
            edges_created += 1
            print(f"      ↳ Linked to: {rel['past_event_title']}... ({rel['relationship']}, score: {rel['score']:.1f})")
        
        except Exception as e:
            # Ignore constraint violations (edge already exists)
            if "23505" not in str(e) and "42P10" not in str(e):
                print(f"   ⚠️ Failed to create causal edge: {e}")
    
    return edges_created


async def process_causal_links(
    events: list[dict],
    db,
    days_back: int = 7,
    min_score: float = 5.0
) -> dict:
    """
    Process causal linking for a batch of events.
    
    Args:
        events: List of event dicts (must have id, location_name, entities, etc.)
        db: Supabase client
        days_back: How far back to look for related events
        min_score: Minimum score to create a link
    
    Returns:
        Stats dict with events_processed, links_created
    """
    if not events:
        return {"events_processed": 0, "links_created": 0}
    
    print(f"\n🔗 Processing causal links for {len(events)} events...")
    
    total_links = 0
    events_with_links = 0
    
    for event in events:
        if not event.get("id"):
            continue
        
        # Find related past events
        related = await find_related_events(
            event, db, 
            days_back=days_back,
            min_score=min_score
        )
        
        if related:
            print(f"\n   📍 {event.get('title', 'Unknown')[:50]}...")
            links = await create_causal_edges(event, related, db)
            total_links += links
            if links > 0:
                events_with_links += 1
    
    if total_links > 0:
        print(f"\n   ✓ Created {total_links} causal links for {events_with_links} events")
    else:
        print(f"\n   ℹ No causal links found (events may be unrelated to recent history)")
    
    return {
        "events_processed": len(events),
        "links_created": total_links,
        "events_with_links": events_with_links
    }
