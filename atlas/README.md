# Atlas - The Everything Engine

**Realpolitik's database schema and migrations**

Renamed from `supabase/` to reflect that this is the **Atlas** knowledge graph and event storage system.

---

## Directory Contents

```
atlas/
├── config.toml           # Supabase configuration
├── .gitignore           # Ignore seed data and .temp files
└── migrations/          # Database schema migrations
    ├── 20260126185244_atlas_foundation.sql
    ├── 20260126195358_users.sql
    ├── 20260126202335_push_subscriptions.sql
    ├── 20260126205430_user_state.sql
    ├── 20260126220000_inbox_preferences.sql
    └── 20260127000000_constellation_enhancements.sql
```

---

## Schema Overview

### Events & Timeline

- `event_details` - Core event data
- `event_sources` - Multiple sources per event
- `nodes` - Geographic locations & entities (legacy)
- `edges` - Connections between entities (legacy)

### Constellation (Knowledge Graph)

- `constellation_nodes` - Entities and events as graph nodes
- `constellation_edges` - Relationships with multi-dimensional weights
- `entity_aliases` - Fast alias lookup for entity resolution
- `event_entities` - Links events to extracted entities

### Users & Subscriptions

- `profiles` - User profiles
- `push_subscriptions` - Web push endpoints
- `user_state` - Read/reaction state
- `inbox_preferences` - Notification preferences

### Reactions & Engagement

- `reactions` - User reactions (threat assessment, consensus)

---

## Using Supabase CLI

**Important:** The Supabase CLI expects a directory named `supabase` by default. Since we renamed it to `atlas`, you need to either:

### Option 1: Use --workdir flag (Recommended)

```bash
# From realpolitik root
npx supabase db push --workdir atlas
npx supabase migration new my_migration --workdir atlas
npx supabase db reset --workdir atlas
```

### Option 2: Create symlink

```bash
ln -s atlas supabase
# Then use normal commands
npx supabase db push
```

### Option 3: Temporarily rename

```bash
mv atlas supabase
npx supabase db push
mv supabase atlas
```

**Recommended:** Use Option 1 (--workdir flag) to avoid confusion.

---

## Migrations

### Current Migrations (6 files)

1. **atlas_foundation.sql** - Core event schema
   - event_details, event_sources
   - Legacy nodes & edges
   - Reactions system

2. **users.sql** - User profiles
   - profiles table
   - RLS policies

3. **push_subscriptions.sql** - Push notification system
   - push_subscriptions table
   - insert_event() RPC function

4. **user_state.sql** - User interaction state
   - user_state table (read status, reactions)

5. **inbox_preferences.sql** - Notification preferences
   - inbox_preferences table

6. **constellation_enhancements.sql** - Knowledge graph ⭐
   - constellation_nodes (entities + events)
   - constellation_edges (relationships with weights)
   - entity_aliases (resolution cache)
   - event_entities (many-to-many links)
   - Graph traversal functions (get_impact_chain)
   - Entity resolution functions
   - Edge touch functions

---

## Running Migrations

```bash
cd /home/james/realpolitik

# Push all migrations to Supabase
npx supabase db push --workdir atlas

# Create new migration
npx supabase migration new my_new_migration --workdir atlas

# Reset local database
npx supabase db reset --workdir atlas
```

---

## Schema Extensions Required

The Constellation schema requires these PostgreSQL extensions:

- ✅ `vector` - pgvector for embeddings
- ✅ `pg_trgm` - Fuzzy text search
- ✅ `btree_gist` - Required for exclusion constraints
- ⚠️ `pgmq` - Optional: Postgres message queue (for Wave 6)

Enable in Supabase dashboard or via migration.

---

## Related Projects

**Argus** (`/home/james/argus/`) - Intelligence engine that writes to this database

- Processes news articles
- Extracts entities and relationships
- Generates embeddings
- Stores in Atlas schema

**Realpolitik** (`/home/james/realpolitik/`) - Frontend that reads from this database

- Displays events on globe
- Shows knowledge graph connections
- Briefing chat interface
- User reactions and preferences

---

## Why "Atlas"?

From Greek mythology: Atlas holds up the world.

In Realpolitik: **Atlas holds up the knowledge** - the foundation that supports the entire intelligence system.

The database IS Atlas:

- Events = points in time and space
- Entities = the actors
- Edges = the connections
- Together = the living map of geopolitics

---

**The graph is the product. Connections are the value.**
