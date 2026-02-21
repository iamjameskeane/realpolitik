#!/usr/bin/env python3
"""
Test push notifications to subscribed devices.

Usage:
    python scripts/test_push.py                  # Send test with default values
    python scripts/test_push.py --severity 9     # Send as critical (severity 9+)
    python scripts/test_push.py --message "Custom test message"
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Manual .env loading fallback
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())

from ..notifications.push import send_push_notification


def main():
    parser = argparse.ArgumentParser(description="Test push notifications")
    parser.add_argument(
        "--message", "-m",
        default="Test notification from Argus",
        help="Custom message body"
    )
    parser.add_argument(
        "--severity", "-s",
        type=int,
        default=5,
        help="Severity level (1-10, 9+ is critical)"
    )
    parser.add_argument(
        "--category", "-c",
        default="TEST",
        help="Event category"
    )
    parser.add_argument(
        "--region",
        default="global",
        help="Event region"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be sent without sending"
    )
    args = parser.parse_args()
    
    # Load config
    push_api_url = os.getenv("PUSH_API_URL", "https://realpolitik.world/api/push/send")
    push_api_secret = os.getenv("PUSH_API_SECRET", "")
    push_notification_threshold = int(os.getenv("PUSH_NOTIFICATION_THRESHOLD", "1"))
    push_critical_threshold = int(os.getenv("PUSH_CRITICAL_THRESHOLD", "9"))
    push_max_age_hours = int(os.getenv("PUSH_MAX_AGE_HOURS", "4"))
    
    if not push_api_secret:
        print("❌ PUSH_API_SECRET not set in environment")
        print("   Add it to your .env file to test push notifications")
        sys.exit(1)
    
    # Create test event
    test_event = {
        "id": f"test-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}",
        "title": args.message,
        "summary": "This is a test notification sent from the Argus test script.",
        "severity": args.severity,
        "category": args.category,
        "region": args.region,
        "location_name": "Test Location",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sources": [{
            "id": "test-source",
            "headline": args.message,
            "summary": "Test source",
            "source_name": "Argus Test",
            "source_url": "https://example.com/test",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }]
    }
    
    is_critical = args.severity >= push_critical_threshold
    
    print("=" * 60)
    print("📲 TEST PUSH NOTIFICATION")
    print("=" * 60)
    print(f"   API URL: {push_api_url}")
    print(f"   Secret: {'*' * 8}...{push_api_secret[-4:] if len(push_api_secret) > 4 else '****'}")
    print(f"   Severity threshold: {push_notification_threshold}+")
    print(f"   Critical threshold: {push_critical_threshold}+")
    print()
    print(f"   Event ID: {test_event['id']}")
    print(f"   Message: {args.message}")
    print(f"   Severity: {args.severity} {'🚨 CRITICAL' if is_critical else ''}")
    print(f"   Category: {args.category}")
    print(f"   Region: {args.region}")
    print()
    
    if args.dry_run:
        print("   🔍 DRY RUN - notification not sent")
        print()
        print("   Payload that would be sent:")
        import json
        payload = {
            "title": "Realpolitik",
            "body": args.message[:200],
            "url": f"/?event={test_event['id']}",
            "id": test_event['id'],
            "severity": args.severity,
            "category": args.category,
            "region": args.region,
            "location_name": "Test Location",
            "sources_count": 1,
            "critical": is_critical,
        }
        print(json.dumps(payload, indent=2))
        return
    
    print("   📤 Sending notification...")
    print()
    
    success = send_push_notification(
        event=test_event,
        push_api_url=push_api_url,
        push_api_secret=push_api_secret,
        push_notification_threshold=push_notification_threshold,
        push_critical_threshold=push_critical_threshold,
        push_max_age_hours=push_max_age_hours,
    )
    
    print()
    if success:
        print("✅ Test notification sent successfully!")
        print("   Check your subscribed devices for the notification.")
    else:
        print("❌ Failed to send test notification")
        print("   Check the error message above for details.")


if __name__ == "__main__":
    main()
