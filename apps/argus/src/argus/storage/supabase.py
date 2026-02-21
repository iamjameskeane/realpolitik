"""
Supabase storage backend.
"""


async def update_event_fallout(
    event_uuid: str,
    fallout_prediction: str,
    supabase_url: str,
    supabase_service_key: str
) -> bool:
    """
    Update just the fallout_prediction field for an event.
    Used in graph-first synthesis where events are written before fallout analysis.
    
    Args:
        event_uuid: Database UUID of the event
        fallout_prediction: The fallout analysis to save
        supabase_url: Supabase project URL
        supabase_service_key: Supabase service role key
    
    Returns:
        True if successful, False otherwise
    """
    from supabase import create_client
    
    try:
        supabase = create_client(supabase_url, supabase_service_key)
        
        # Update event_details table directly (events is a VIEW, not a table)
        # The event UUID from insert_event RPC is the node_id in event_details
        result = supabase.table("event_details").update({
            "fallout_prediction": fallout_prediction
        }).eq("node_id", event_uuid).execute()
        
        return bool(result.data)
    except Exception as e:
        print(f"   ⚠️ Failed to update fallout for {event_uuid}: {e}")
        return False


async def write_supabase(
    events: list,
    supabase_url: str,
    supabase_service_key: str
) -> list[dict]:
    """
    Write events to Supabase using the insert_event RPC function.
    
    Args:
        events: List of GeoEvent objects
        supabase_url: Supabase project URL
        supabase_service_key: Supabase service role key
    
    Returns:
        The final event list for notification processing.
    """
    from supabase import create_client, Client
    
    if not all([supabase_url, supabase_service_key]):
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables required")
    
    supabase: Client = create_client(supabase_url, supabase_service_key)
    
    print(f"\n💾 Writing {len(events)} events to Supabase...")
    
    inserted_events = []
    errors = 0
    
    for event in events:
        try:
            # Extract coordinates - format is (lng, lat) tuple
            coords = event.coordinates if hasattr(event, 'coordinates') else (None, None)
            lng = coords[0] if coords and len(coords) > 0 else None
            lat = coords[1] if coords and len(coords) > 1 else None
            
            # Convert sources to JSON-serializable format
            sources_data = [s.model_dump() if hasattr(s, 'model_dump') else s for s in event.sources]
            
            # Call insert_event RPC with individual parameters
            result = supabase.rpc("insert_event", {
                "p_title": event.title,
                "p_summary": event.summary,
                "p_category": event.category,
                "p_severity": event.severity,
                "p_location_name": event.location_name,
                "p_lng": lng,
                "p_lat": lat,
                "p_region": event.region,
                "p_timestamp": event.timestamp,
                "p_fallout_prediction": event.fallout_prediction,
                "p_sources": sources_data,
                "p_cameo_code": event.cameo_code,
                "p_cameo_label": event.cameo_label,
            }).execute()
            
            if result.data:
                # Get the event back with its UUID
                event_dict = event.model_dump()
                event_dict["id"] = result.data  # UUID from database
                inserted_events.append(event_dict)
            else:
                errors += 1
                print(f"   ⚠️ Failed to insert: {event.title[:50]}...")
                
        except Exception as e:
            errors += 1
            print(f"   ⚠️ Error inserting {event.title[:50]}...: {type(e).__name__}: {e}")
    
    total_sources = sum(len(e.get("sources", [])) for e in inserted_events)
    print(f"☁️  Wrote {len(inserted_events)} events ({total_sources} total sources) to Supabase")
    
    if errors > 0:
        print(f"⚠️  {errors} events failed to insert")
    
    return inserted_events
