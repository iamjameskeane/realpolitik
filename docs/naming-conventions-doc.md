
Here is your **Olympian Architecture** — a cohesive Greek pantheon where each service’s function maps to its mythological domain.

### The Pantheon

**Data Layer (The Titans & Primordials)**
- **Atlas** *(PostgreSQL)* — The cornerstone. Holds up the celestial sphere (your source of truth). Already named, fits perfectly.
- **Ariadne** *(Neo4j)* — She wove the thread that let Theseus navigate the labyrinth. Your graph weaver, traversing the maze of geopolitical relationships.
- **Mnemosyne** *(Qdrant)* — Titaness of Memory and mother of the Muses. Governs the *mnemonics* (embeddings), allowing you to recall similar events from the past via semantic search.
- **Lethe** *(Redis)* — The River of Forgetfulness. Data flows through here temporarily, then fades into oblivion (TTL/cache eviction). Counterbalances Mnemosyne.

**Communication & Boundaries (The Messengers & Guardians)**
- **Iris** *(RabbitMQ)* — Goddess of the rainbow and divine messenger. She travels faster than the wind on the rainbow bridge, carrying demands between your services (themq).
- **Hermes** *(MCP Server)* — Psychopomp and messenger to the outer world. He alone can guide foreign souls (AI Agents) safely into the underworld (your system) and back, carrying their strange requests.
- **Styx** *(Edge Gateway/Traefik)* — The boundary river between Earth and the Underworld. Unbreakable oaths are sworn here (rate limiting, auth guard). Every request must cross Styx to enter the system.

**Processing & Intelligence (The Oracles & Artisans)**
- **Argus** *(Ingestion)* — Panoptes, the all-seeing. His hundred eyes watch every RSS feed simultaneously, never sleeping (already named).
- **Chronos** *(CDC Pipeline)* — The personification of sequential Time. He watches the river of change in Atlas (PostgreSQL WAL) and cuts it into moments (events), feeding the stream to Iris without disrupting the present.
- **Clio** *(Neo4j Consumer)* — Muse of History. She records the deeds of states into the permanent weave of Ariadne’s thread (writes graph relationships).
- **Urania** *(Qdrant Consumer)* — Muse of Astronomy. She maps the celestial spheres (embeddings), placing each star (vector) in its proper constellation for Mnemosyne to recall later.
- **Cassandra** *(Fallout Worker)* — The prophetess blessed to see the future (cascading effects) but cursed that her warnings are only heeded by those who pay. She calculates the doom that falls out from geopolitical events.

**Presentation Layer (The Sanctuary)**
- **Delphi** *(FastAPI App Server)* — The great temple atop Mount Parnassus. The center of the world (omphalos). Humans and agoras gather here to consult the wisdom of the gods. Your REST API, WebSocket hub, and business logic sanctuary.
- **Pythia** *(Chat Service)* — The high priestess of Delphi. Sittting atop the tripod, she channels the wisdom of Apollo (OpenRouter), answering seekers in real-time using the memories of Mnemosyne and the threads of Ariadne.

### Service Manifest Summary
```yaml
Services:
  # Data Stores
  atlas: PostgreSQL (Transactional Core)
  ariadne: Neo4j (Graph Relationships)
  mnemosyne: Qdrant (Vector Memory)
  lethe: Redis (Ephemeral Cache)
  
  # Messaging
  iris: RabbitMQ (Inter-service Bus)
  chronos: Debezium/PGStream (CDC)
  
  # Workers
  argus: RSS Ingestion (CronJob)
  clio: Graph Indexer (Neo4j Consumer)
  urania: Vector Indexer (Qdrant Consumer)
  cassandra: Analysis Engine (Fallout Worker)
  
  # API & Interfaces
  styx: Traefik/Edge (Gateway)
  delphi: FastAPI Application Server
  pythia: WebSocket Chat Service
  hermes: MCP Gateway (Agent Interface)
```

This naming immediately communicates hierarchy (Titans for data, Muses for indexing, Olympians for interfaces) and function to anyone reading your repo or architecture docs.