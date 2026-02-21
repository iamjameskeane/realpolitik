#!/usr/bin/env python3
"""
Quick script to explore the knowledge graph data.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(Path(__file__).parent.parent)

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

db = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

print("=" * 60)
print("📊 CONSTELLATION GRAPH STATS")
print("=" * 60)

# Count nodes by type
print("\n📍 NODES BY TYPE:")
result = db.table("nodes").select("node_type").execute()
if result.data:
    from collections import Counter
    types = Counter(n["node_type"] for n in result.data)
    for t, count in sorted(types.items(), key=lambda x: -x[1]):
        print(f"   {t}: {count}")
    print(f"   TOTAL: {len(result.data)}")

# Count edges by type
print("\n🔗 EDGES BY TYPE:")
result = db.table("edges").select("relation_type").execute()
if result.data:
    from collections import Counter
    types = Counter(e["relation_type"] for e in result.data)
    for t, count in sorted(types.items(), key=lambda x: -x[1]):
        print(f"   {t}: {count}")
    print(f"   TOTAL: {len(result.data)}")

# Top entities by hit_count
print("\n🏆 TOP ENTITIES (by hit_count):")
result = db.table("nodes").select("name, node_type, hit_count").neq(
    "node_type", "event"
).order("hit_count", desc=True).limit(15).execute()
if result.data:
    for n in result.data:
        print(f"   {n['name']} ({n['node_type']}): {n['hit_count']} hits")

# Sample entities by type
print("\n🌍 SAMPLE COUNTRIES:")
result = db.table("nodes").select("name, hit_count").eq(
    "node_type", "country"
).order("hit_count", desc=True).limit(10).execute()
if result.data:
    for n in result.data:
        print(f"   {n['name']}: {n['hit_count']} events")

print("\n👤 SAMPLE LEADERS:")
result = db.table("nodes").select("name, hit_count").eq(
    "node_type", "leader"
).order("hit_count", desc=True).limit(10).execute()
if result.data:
    for n in result.data:
        print(f"   {n['name']}: {n['hit_count']} events")

print("\n🏢 SAMPLE COMPANIES/ORGS:")
result = db.table("nodes").select("name, node_type, hit_count").in_(
    "node_type", ["company", "organization"]
).order("hit_count", desc=True).limit(10).execute()
if result.data:
    for n in result.data:
        print(f"   {n['name']} ({n['node_type']}): {n['hit_count']} events")

# Events with most entities
print("\n📰 EVENTS WITH MOST ENTITIES:")
result = db.rpc("get_events_by_entity_count", {}).execute() if False else None
# Fallback: count edges from events
result = db.table("edges").select("source_id").in_(
    "relation_type", ["involves", "affects", "occurred_in", "mentions"]
).execute()
if result.data:
    from collections import Counter
    event_counts = Counter(e["source_id"] for e in result.data)
    top_events = event_counts.most_common(5)
    for event_id, count in top_events:
        # Get event title
        ev = db.table("events").select("title").eq("id", event_id).limit(1).execute()
        if ev.data:
            print(f"   {ev.data[0]['title'][:50]}... ({count} entities)")

# Check for potential duplicates
print("\n⚠️ POTENTIAL DUPLICATES (same name, different nodes):")
result = db.table("nodes").select("name, node_type, id").neq(
    "node_type", "event"
).execute()
if result.data:
    from collections import defaultdict
    names = defaultdict(list)
    for n in result.data:
        names[n["name"].lower()].append(n)
    
    dups = [(name, nodes) for name, nodes in names.items() if len(nodes) > 1]
    if dups:
        for name, nodes in sorted(dups, key=lambda x: -len(x[1]))[:5]:
            types = [n["node_type"] for n in nodes]
            print(f"   '{name}': {len(nodes)} nodes ({types})")
    else:
        print("   None found!")

print("\n" + "=" * 60)
