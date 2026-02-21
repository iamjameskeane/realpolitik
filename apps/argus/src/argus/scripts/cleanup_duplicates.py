#!/usr/bin/env python3
"""
Remove duplicate events from the database.

Keeps the most recent event for each title and deletes the rest.

Usage:
    python scripts/cleanup_duplicates.py --dry-run   # Preview what would be deleted
    python scripts/cleanup_duplicates.py             # Actually delete duplicates
"""

import argparse
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client


def find_duplicates(supabase):
    """Find events with duplicate titles."""
    print('Fetching events...')
    result = supabase.table('events').select(
        'id, title, location_name, sources, created_at'
    ).order('created_at', desc=True).limit(1000).execute()
    
    print(f'Found {len(result.data)} events')
    
    # Group by title
    title_to_events = defaultdict(list)
    
    for event in result.data:
        title = event.get('title', '').strip()
        if title:
            title_to_events[title].append({
                'id': event['id'],
                'location': event.get('location_name', ''),
                'sources': len(event.get('sources', [])),
                'created_at': event.get('created_at', '')
            })
    
    # Find titles with multiple events
    duplicates = {}
    for title, events in title_to_events.items():
        if len(events) > 1:
            # Sort by created_at descending (newest first)
            events.sort(key=lambda x: x['created_at'], reverse=True)
            duplicates[title] = {
                'keep': events[0],  # Keep newest
                'delete': events[1:]  # Delete rest
            }
    
    return duplicates


def cleanup_duplicates(supabase, duplicates, dry_run=True):
    """Delete duplicate events."""
    total_to_delete = sum(len(d['delete']) for d in duplicates.values())
    
    print(f'\n{"[DRY RUN] " if dry_run else ""}Found {len(duplicates)} titles with duplicates')
    print(f'{"[DRY RUN] " if dry_run else ""}Will delete {total_to_delete} duplicate events')
    
    if dry_run:
        print('\nSample of what would be deleted:')
        for title, data in list(duplicates.items())[:5]:
            print(f'\n  "{title[:50]}..."')
            print(f'    KEEP: {data["keep"]["location"]} ({data["keep"]["created_at"][:19]})')
            for d in data['delete'][:3]:
                print(f'    DELETE: {d["location"]} ({d["created_at"][:19]})')
            if len(data['delete']) > 3:
                print(f'    ... and {len(data["delete"]) - 3} more')
        return
    
    # Actually delete
    deleted = 0
    errors = 0
    
    for title, data in duplicates.items():
        for event in data['delete']:
            try:
                # Delete from nodes table (cascades to event_details via FK)
                supabase.table('nodes').delete().eq('id', event['id']).execute()
                deleted += 1
                if deleted % 50 == 0:
                    print(f'  Deleted {deleted}/{total_to_delete}...')
            except Exception as e:
                errors += 1
                print(f'  Error deleting {event["id"]}: {e}')
    
    print(f'\n✓ Deleted {deleted} duplicate events')
    if errors:
        print(f'⚠️ {errors} errors occurred')


def main():
    parser = argparse.ArgumentParser(description='Remove duplicate events')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Preview without deleting')
    args = parser.parse_args()
    
    supabase = create_client(
        os.environ['NEXT_PUBLIC_SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_ROLE_KEY']
    )
    
    duplicates = find_duplicates(supabase)
    
    if not duplicates:
        print('No duplicates found!')
        return
    
    cleanup_duplicates(supabase, duplicates, dry_run=args.dry_run)


if __name__ == '__main__':
    main()
