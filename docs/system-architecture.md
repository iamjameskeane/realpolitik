graph TB
    %% External Entities
    RSS[RSS Feeds]
    OpenRouter[OpenRouter]
    Stripe[Stripe]
    Client[Flutter Client / Astro Web]
    Agent[AI Agent<br/>MCP Client]

    %% Edge Layer
    subgraph Edge [Edge Layer]
        Styx[Styx<br/>API Gateway / Traefik]
    end

    %% API Layer
    subgraph API [API Layer]
        Delphi[Delphi<br/>App Server]
        Pythia[Pythia<br/>Chat Service]
        Hermes[Hermes<br/>MCP Server]
    end

    %% Message Bus
    subgraph Messaging [Message Bus]
        Iris[Iris<br/>RabbitMQ]
    end

    %% Processing Layer
    subgraph Ingestion [Ingestion & CDC]
        Argus[Argus<br/>RSS Ingestion]
        Chronos[Chronos<br/>CDC Pipeline]
    end

    subgraph Workers [Fanout Workers]
        Clio[Clio<br/>Graph Writer]
        Urania[Urania<br/>Vector Writer]
        Cassandra[Cassandra<br/>Fallout Engine]
    end

    %% Data Layer
    subgraph Data [Data Layer]
        Atlas[Atlas<br/>PostgreSQL<br/>Source of Truth]
        Ariadne[Ariadne<br/>Neo4j<br/>Graph]
        Mnemosyne[Mnemosyne<br/>Qdrant<br/>Vector Search]
        Lethe[Lethe<br/>Redis<br/>Cache]
    end

    %% INGESTION FLOW (Left to Data)
    RSS -->|Consume| Argus
    Argus -->|Write Events<br/>Outbox Pattern| Atlas
    Atlas -->|WAL Stream| Chronos
    Chronos -->|Publish Events| Iris

    %% FANOUT TO DATA STORES
    Iris -->|event.ingested| Clio
    Iris -->|event.ingested| Urania
    Clio -->|Write Relationships| Ariadne
    Urania -->|Write Embeddings| Mnemosyne

    %% CLIENT ACCESS (Top)
    Client -->|HTTPS/WSS| Styx
    Agent -->|MCP Protocol| Styx
    Styx -->|Route| Delphi
    Styx -->|Route| Hermes

    %% DELPHI DATA ACCESS
    Delphi <-->|Read/Write| Atlas
    Delphi -->|Query Graph| Ariadne
    Delphi -->|Semantic Search| Mnemosyne
    Delphi -->|Cache Read/Write| Lethe
    Delphi -->|Request Analysis| Iris
    Delphi <-->|WebSocket| Pythia

    %% Pythia FLOW
    Pythia -->|RAG Context| Mnemosyne
    Pythia -->|RAG Context| Ariadne
    Pythia -->|Chat History| Atlas
    Pythia -->|LLM Calls| OpenRouter

    %% HERMES (MCP) FLOW
    Hermes -->|Graph Queries| Ariadne
    Hermes -->|Vector Search| Mnemosyne
    Hermes -->|Request Analysis| Iris

    %% CASSANDRA (FALLOUT) FLOW
    Iris -->|analysis.requested| Cassandra
    Cassandra -->|Read Events| Atlas
    Cassandra -->|Read Relations| Ariadne
    Cassandra -->|Read Analogues| Mnemosyne
    Cassandra -->|Generate via LLM| OpenRouter
    Cassandra -->|Store Result| Atlas
    Cassandra -->|Cache Result| Lethe

    %% STALING / INVALIDATION
    Atlas -.->|Invalidation<br/>Events| Iris
    Iris -.->|Reprocess| Cassandra

    %% BILLING
    Delphi -->|Subscriptions| Stripe

    %% STYLING
    classDef external fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef data fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef compute fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef edge fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
    classDef msg fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    
    class RSS,OpenRouter,Stripe,Client,Agent external
    class Atlas,Ariadne,Mnemosyne,Lethe data
    class Argus,Chronos,Clio,Urania,Cassandra,Pythia,Hermes,Delphi compute
    class Styx edge
    class Iris msg