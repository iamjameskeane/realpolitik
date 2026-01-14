#!/usr/bin/env python3
"""
Local development script that runs the worker on a schedule.
Behaves like a cron job - fetches new events, enriches them, and updates events.json.

Usage:
    python worker/run_local.py                    # Run once
    python worker/run_local.py --watch            # Run every 5 minutes
    python worker/run_local.py --watch --interval 10  # Run every 10 minutes
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

# Add worker directory to path
sys.path.insert(0, str(Path(__file__).parent))

from main import main as run_worker_sync


def load_existing_events(events_path: Path) -> list[dict]:
    """Load existing events from JSON file."""
    if events_path.exists():
        with open(events_path, "r") as f:
            return json.load(f)
    return []


def merge_events(existing: list[dict], new: list[dict]) -> tuple[list[dict], int]:
    """
    Merge new events with existing ones.
    Returns (merged_events, new_count).
    Deduplicates by event ID and keeps the most recent version.
    """
    events_by_id = {e["id"]: e for e in existing}
    new_count = 0
    
    for event in new:
        if event["id"] not in events_by_id:
            new_count += 1
        events_by_id[event["id"]] = event
    
    # Sort by timestamp (newest first) and limit to last 100 events
    merged = sorted(
        events_by_id.values(),
        key=lambda e: e["timestamp"],
        reverse=True
    )[:100]
    
    return merged, new_count


def run_once(events_path: Path) -> int:
    """Run the worker once and merge results. Returns count of new events."""
    print(f"\n{'='*60}")
    print(f"🔄 Running worker at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    
    try:
        # Check existing event count
        existing_events = load_existing_events(events_path)
        existing_count = len(existing_events)
        existing_ids = {e["id"] for e in existing_events}
        
        # Run the worker (it writes directly to public/events.json)
        run_worker_sync()
        
        # Load the updated output
        if not events_path.exists():
            print("❌ Worker did not produce output")
            return 0
        
        with open(events_path, "r") as f:
            updated_events = json.load(f)
        
        # Count new events
        new_count = sum(1 for e in updated_events if e["id"] not in existing_ids)
        
        print(f"\n✅ Done! {new_count} new events, {len(updated_events)} total")
        return new_count
        
    except Exception as e:
        print(f"❌ Error running worker: {e}")
        import traceback
        traceback.print_exc()
        return 0


def watch_mode(events_path: Path, interval_minutes: int):
    """Run the worker on a schedule."""
    print(f"👀 Watch mode: Running every {interval_minutes} minutes")
    print(f"   Output: {events_path}")
    print(f"   Press Ctrl+C to stop\n")
    
    while True:
        new_count = run_once(events_path)
        
        if new_count > 0:
            print(f"🔔 {new_count} new event(s) detected!")
        
        next_run = datetime.now().timestamp() + (interval_minutes * 60)
        next_run_str = datetime.fromtimestamp(next_run).strftime('%H:%M:%S')
        print(f"\n⏰ Next run at {next_run_str}")
        
        try:
            time.sleep(interval_minutes * 60)
        except KeyboardInterrupt:
            print("\n\n👋 Stopping watch mode")
            break


def main():
    parser = argparse.ArgumentParser(
        description="Run the Realpolitik worker locally"
    )
    parser.add_argument(
        "--watch", "-w",
        action="store_true",
        help="Run continuously on a schedule"
    )
    parser.add_argument(
        "--interval", "-i",
        type=int,
        default=5,
        help="Minutes between runs in watch mode (default: 5)"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default=None,
        help="Output path for events.json"
    )
    
    args = parser.parse_args()
    
    # Determine output path
    if args.output:
        events_path = Path(args.output)
    else:
        # Default to public/events.json in the project root
        project_root = Path(__file__).parent.parent
        events_path = project_root / "public" / "events.json"
    
    events_path.parent.mkdir(parents=True, exist_ok=True)
    
    if args.watch:
        watch_mode(events_path, args.interval)
    else:
        run_once(events_path)


if __name__ == "__main__":
    main()
