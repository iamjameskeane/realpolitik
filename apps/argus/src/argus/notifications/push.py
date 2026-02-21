"""
Push notification delivery.
"""

from datetime import datetime, timezone
from ..regions import get_region


def send_push_notification(
    event: dict,
    push_api_url: str,
    push_api_secret: str,
    push_notification_threshold: int,
    push_critical_threshold: int,
    push_max_age_hours: int
) -> bool:
    """
    Send push notification for an event to the API.
    
    The API handles per-subscription deduplication, ensuring each subscriber
    only receives each event once, even if this function is called multiple times.
    User-defined rules filter which events each subscriber receives.
    
    Args:
        event: Event dict with id, title, summary, severity, category, timestamp
        push_api_url: API endpoint URL
        push_api_secret: API secret for authentication
        push_notification_threshold: Minimum severity to notify
        push_critical_threshold: Severity threshold for critical flag
        push_max_age_hours: Max age of event to notify (hours)
        
    Returns:
        True if sent successfully, False otherwise
    """
    import requests
    
    if not push_api_secret:
        print("   ⚠️ PUSH_API_SECRET not set, skipping notification")
        return False
    
    event_id = event.get("id", "")
    severity = event.get("severity", 0)
    
    # Basic severity filter - user rules handle granular filtering
    if severity < push_notification_threshold:
        return False
    
    # Check article age - only notify for recent news
    sources = event.get("sources", [])
    if sources:
        latest_source = max(sources, key=lambda s: s.get("timestamp", ""))
        timestamp_str = latest_source.get("timestamp", event.get("timestamp", ""))
    else:
        timestamp_str = event.get("timestamp", "")
    
    if timestamp_str:
        try:
            if timestamp_str.endswith("Z"):
                timestamp_str = timestamp_str[:-1] + "+00:00"
            event_time = datetime.fromisoformat(timestamp_str)
            if event_time.tzinfo is None:
                event_time = event_time.replace(tzinfo=timezone.utc)
            
            age_hours = (datetime.now(timezone.utc) - event_time).total_seconds() / 3600
            
            if age_hours > push_max_age_hours:
                print(f"   ⏭️ Skipping old event ({age_hours:.1f}h old): {event.get('title', '')[:40]}...")
                return False
        except (ValueError, TypeError) as e:
            print(f"   ⚠️ Could not parse timestamp '{timestamp_str}': {e}")
    
    # Mark if this is a critical event
    is_critical = severity >= push_critical_threshold
    
    # Get region for rule-based filtering (extract if not present)
    region = event.get("region")
    if not region:
        region = get_region(event.get("location_name", ""))
    
    # Count sources for multi-source confirmation rules
    sources = event.get("sources", [])
    sources_count = len(sources) if sources else 1
    
    # Notification format: "Realpolitik" as title, headline as body
    headline = event.get("title", "Breaking news")
    if len(headline) > 200:
        headline = headline[:197] + "..."
    
    payload = {
        "title": "Realpolitik",
        "body": headline,
        "url": f"/?event={event_id}",
        "id": event_id,
        "severity": severity,
        "category": event.get("category"),
        "region": region,
        "location_name": event.get("location_name", ""),
        "sources_count": sources_count,
        "critical": is_critical,
    }
    
    try:
        response = requests.post(
            push_api_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {push_api_secret}",
                "Content-Type": "application/json",
                # Bypass Vercel firewall protection on preview/development deployments
                "x-vercel-protection-bypass": push_api_secret,
            },
            timeout=10,
        )
        
        if response.ok:
            result = response.json()
            critical_tag = " 🚨 CRITICAL" if is_critical else ""
            print(f"   🔔 Push sent{critical_tag}: {result.get('sent', 0)} delivered, {result.get('failed', 0)} failed")
            return True
        else:
            print(f"   ⚠️ Push failed: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ⚠️ Push error: {type(e).__name__}: {e}")
        return False


def notify_high_severity_events(
    events: list[dict],
    push_api_url: str,
    push_api_secret: str,
    push_notification_threshold: int,
    push_critical_threshold: int,
    push_max_age_hours: int
) -> int:
    """
    Check events and send push notifications for significant ones.
    
    The API handles per-subscription deduplication, ensuring each subscriber
    only receives each event once. User-defined rules control which events
    each subscriber receives based on severity, category, region, etc.
    
    Args:
        events: List of event dicts to check
        push_api_url: API endpoint URL
        push_api_secret: API secret for authentication
        push_notification_threshold: Minimum severity to notify
        push_critical_threshold: Severity threshold for critical flag
        push_max_age_hours: Max age of event to notify (hours)
        
    Returns:
        Number of notifications sent
    """
    print("\n" + "=" * 60)
    print("📲 PUSH NOTIFICATIONS")
    print("=" * 60)
    print(f"   API URL: {push_api_url}")
    print(f"   Secret configured: {'✓' if push_api_secret else '✗ MISSING'}")
    print(f"   Severity threshold: {push_notification_threshold}+ (critical: {push_critical_threshold}+)")
    print(f"   Max age: {push_max_age_hours} hours")
    print(f"   Events to check: {len(events)}")
    
    if not push_api_secret:
        print("   ⚠️ PUSH_API_SECRET not set - skipping all notifications")
        return 0
    
    notified_count = 0
    
    # Count eligible events by severity tier
    eligible = [e for e in events if e.get("severity", 0) >= push_notification_threshold]
    critical = [e for e in eligible if e.get("severity", 0) >= push_critical_threshold]
    print(f"   🎯 Events at severity {push_notification_threshold}+: {len(eligible)} ({len(critical)} critical)")
    
    # Sort by severity descending so critical events are processed first
    sorted_events = sorted(
        eligible,
        key=lambda e: e.get("severity", 0),
        reverse=True
    )
    
    for event in sorted_events:
        severity = event.get("severity", 0)
        title = event.get("title", "Unknown")[:50]
        is_critical = severity >= push_critical_threshold
        critical_tag = "🚨" if is_critical else "📍"
        print(f"\n   {critical_tag} [{severity}] {title}...")
        
        if send_push_notification(
            event,
            push_api_url,
            push_api_secret,
            push_notification_threshold,
            push_critical_threshold,
            push_max_age_hours
        ):
            notified_count += 1
    
    # Summary
    print(f"\n   {'─' * 40}")
    print(f"   📊 PUSH SUMMARY: {notified_count} sent, {len(eligible) - notified_count} skipped")
    
    return notified_count
