#!/usr/bin/env python3
"""
Backfill causal links between existing events.

Usage:
    python scripts/backfill_causal_links.py              # All events
    python scripts/backfill_causal_links.py --limit 100  # Recent 100 only
    python scripts/backfill_causal_links.py --dry-run    # Preview without creating
"""

import asyncio
import argparse
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client
from ..pipeline.causal_linking import find_related_events, create_causal_edges


async def backfill_causal_links(limit: int = None, dry_run: bool = False):
    supabase = create_client(
        os.environ['NEXT_PUBLIC_SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_ROLE_KEY']
    )
    
    print('=' * 70)
    print('BACKFILLING CAUSAL LINKS')
    if dry_run:
        print('DRY RUN - no edges will be created')
    print('=' * 70)
    
    # Get events ordered by creation date (oldest first)
    query = supabase.table('nodes').select('id, name, created_at').eq(
        'node_type', 'event'
    ).order('created_at', desc=False)
    
    if limit:
        # Get most recent N events
        query = supabase.table('nodes').select('id, name, created_at').eq(
            'node_type', 'event'
        ).order('created_at', desc=True).limit(limit)
    
    events = query.execute()
    
    # Reverse if we got recent events (so we process oldest first)
    if limit:
        events.data = list(reversed(events.data))
    
    print(f'Processing {len(events.data)} events...')
    print()
    
    total_links = 0
    events_with_links = 0
    processed = 0
    
    for node in events.data:
        processed += 1
        
        # Progress indicator
        if processed % 10 == 0:
            print(f'  Progress: {processed}/{len(events.data)} ({total_links} links created)')
            sys.stdout.flush()
        
        # Get event details
        details = supabase.table('event_details').select(
            'title, category, severity, location_name'
        ).eq('node_id', node['id']).execute()
        
        if not details.data:
            continue
        
        d = details.data[0]
        
        # Get entities
        entities = supabase.rpc('get_event_entities', {'event_uuid': node['id']}).execute()
        
        event = {
            'id': node['id'],
            'title': d.get('title', ''),
            'category': d.get('category', ''),
            'severity': d.get('severity', 5),
            'location_name': d.get('location_name', ''),
            'timestamp': node.get('created_at'),
            'entities': entities.data if entities.data else []
        }
        
        # Find related events
        related = await find_related_events(event, supabase, days_back=7, min_score=5.0)
        
        if related:
            if dry_run:
                print(f'  Would link: {event["title"][:50]}...')
                for r in related:
                    print(f'    → {r["past_event_title"]}... ({r["relationship"]}, score: {r["score"]:.1f})')
                total_links += len(related)
            else:
                links = await create_causal_edges(event, related, supabase)
                total_links += links
                if links > 0:
                    events_with_links += 1
    
    print()
    print('=' * 70)
    print('BACKFILL COMPLETE')
    print(f'  Events processed: {len(events.data)}')
    print(f'  Events with links: {events_with_links}')
    print(f'  Total causal links {"would be " if dry_run else ""}created: {total_links}')
    print('=' * 70)


def main():
    parser = argparse.ArgumentParser(description='Backfill causal links between events')
    parser.add_argument('--limit', type=int, help='Only process N most recent events')
    parser.add_argument('--dry-run', action='store_true', help='Preview without creating edges')
    args = parser.parse_args()
    
    asyncio.run(backfill_causal_links(limit=args.limit, dry_run=args.dry_run))


if __name__ == '__main__':
    main()
