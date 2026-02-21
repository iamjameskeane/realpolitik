"""
Seed common aliases for hub nodes in the knowledge graph.

This prevents creating duplicate entities for common variations like:
- "USA", "US", "United States", "America"
- "China", "PRC", "People's Republic of China"
- etc.

Usage:
    python scripts/seed_aliases.py
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase import create_client


# Common aliases for major entities
ENTITY_ALIASES = {
    # United States
    "united_states": [
        "usa", "us", "united_states", "america", "u.s.", "u.s.a.",
        "united_states_of_america", "the_us", "the_usa"
    ],
    
    # China
    "china": [
        "china", "prc", "peoples_republic_of_china", "mainland_china",
        "beijing", "chinese_government"
    ],
    
    # Russia
    "russia": [
        "russia", "russian_federation", "moscow", "kremlin"
    ],
    
    # European Union
    "european_union": [
        "eu", "european_union", "brussels"
    ],
    
    # United Kingdom
    "united_kingdom": [
        "uk", "united_kingdom", "britain", "great_britain", "u.k."
    ],
    
    # NATO
    "nato": [
        "nato", "north_atlantic_treaty_organization"
    ],
    
    # United Nations
    "united_nations": [
        "un", "united_nations", "u.n."
    ],
    
    # Israel
    "israel": [
        "israel", "idf", "israel_defense_forces"
    ],
    
    # Iran
    "iran": [
        "iran", "islamic_republic_of_iran", "tehran"
    ],
    
    # Taiwan
    "taiwan": [
        "taiwan", "republic_of_china", "taipei", "roc"
    ],
    
    # Ukraine
    "ukraine": [
        "ukraine", "kyiv", "kiev"
    ],
    
    # Major companies
    "tsmc": [
        "tsmc", "taiwan_semiconductor", "taiwan_semiconductor_manufacturing_company"
    ],
    
    "apple": [
        "apple", "apple_inc", "cupertino"
    ],
    
    "nvidia": [
        "nvidia", "nvidia_corporation"
    ],
    
    # Leaders (these change, but common ones)
    "joe_biden": [
        "biden", "joe_biden", "president_biden", "joseph_biden"
    ],
    
    "donald_trump": [
        "trump", "donald_trump", "president_trump"
    ],
    
    "xi_jinping": [
        "xi", "xi_jinping", "president_xi"
    ],
    
    "vladimir_putin": [
        "putin", "vladimir_putin", "president_putin"
    ],
}


def seed_aliases():
    """Seed common aliases into the database."""
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        return
    
    db = create_client(supabase_url, supabase_key)
    
    print("🌱 Seeding entity aliases...")
    print(f"   Total entities: {len(ENTITY_ALIASES)}")
    
    total_aliases = 0
    for canonical_name, aliases in ENTITY_ALIASES.items():
        # For this seed script, we'll assume the canonical nodes already exist
        # In production, you'd want to create them first
        
        print(f"\n   {canonical_name}")
        print(f"      Aliases: {', '.join(aliases)}")
        
        # Note: This is a simplified version
        # In production, you'd:
        # 1. Create the canonical node if it doesn't exist
        # 2. Get its UUID
        # 3. Insert aliases with that UUID
        
        # For now, just print what would be inserted
        total_aliases += len(aliases)
        print(f"      ({len(aliases)} aliases)")
    
    print(f"\n✅ Would seed {total_aliases} total aliases")
    print("\n⚠️  Note: This is a dry-run script.")
    print("   To actually insert aliases:")
    print("   1. Create canonical nodes in constellation_nodes")
    print("   2. Get their UUIDs")
    print("   3. Insert into entity_aliases table")


if __name__ == "__main__":
    seed_aliases()
