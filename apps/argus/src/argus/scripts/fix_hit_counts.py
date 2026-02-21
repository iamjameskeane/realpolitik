#!/usr/bin/env python3
"""
Fix hit_counts on nodes based on existing edges.
"""

import os
import sys
from pathlib import Path
from collections import Counter

sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(Path(__file__).parent.parent)

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

db = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

print("🔧 Fixing hit_counts on entity nodes...")

# Get all event-entity edges
result = db.table("edges").select("target_id, relation_type").in_(
    "relation_type", ["involves", "affects", "occurred_in", "mentions"]
).execute()

if not result.data:
    print("No edges found")
    sys.exit(0)

# Count how many times each entity is referenced
entity_counts = Counter(e["target_id"] for e in result.data)

print(f"   Found {len(result.data)} edges referencing {len(entity_counts)} entities")

# Update each entity's hit_count
updated = 0
for entity_id, count in entity_counts.items():
    try:
        db.table("nodes").update({
            "hit_count": count
        }).eq("id", entity_id).execute()
        updated += 1
    except Exception as e:
        print(f"   ⚠️ Failed to update {entity_id}: {e}")

print(f"   ✅ Updated {updated} entities")

# Show top entities now
print("\n🏆 TOP ENTITIES (by hit_count):")
result = db.table("nodes").select("name, node_type, hit_count").neq(
    "node_type", "event"
).order("hit_count", desc=True).limit(15).execute()

if result.data:
    for n in result.data:
        print(f"   {n['name']} ({n['node_type']}): {n['hit_count']} hits")

print("\n✅ Done!")
