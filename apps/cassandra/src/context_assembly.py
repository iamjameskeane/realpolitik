"""
Context assembly for Cassandra analysis service.
"""

import asyncio
import time
from typing import Dict, List, Any, Optional
from .graph_queries import GraphQueries
from .database_queries import DatabaseQueries
from models.events import AnalysisContext, GraphQueryResult, VectorSearchResult


class ContextAssembler:
    """Assembles comprehensive context for enhanced synthesis."""
    
    def __init__(self, graph_queries: GraphQueries, db_queries: DatabaseQueries):
        self.graph_queries = graph_queries
        self.db_queries = db_queries
    
    async def build_analysis_context(
        self, 
        event_ids: List[str],
        include_historical_analogues: bool = True,
        include_causal_chains: bool = True
    ) -> AnalysisContext:
        """
        Build comprehensive context for analysis.
        
        Args:
            event_ids: List of event IDs to analyze
            include_historical_analogues: Whether to include vector search
            include_causal_chains: Whether to include causal analysis
            
        Returns:
            Complete analysis context
        """
        start_time = time.time()
        
        # Step 1: Fetch primary events from database
        print(f"   📥 Fetching {len(event_ids)} primary events...")
        primary_events = await self.db_queries.fetch_events_by_ids(event_ids)
        
        if not primary_events:
            raise ValueError(f"No events found for IDs: {event_ids}")
        
        # Step 2: Get entities for these events from graph
        print(f"   🕸️  Fetching entity networks...")
        all_entities = []
        entity_networks = []
        
        for event in primary_events:
            try:
                entities = await self.graph_queries.get_event_entities(event["id"])
                all_entities.extend(entities)
                
                # Get network context for each entity
                entity_ids = [e["id"] for e in entities]
                if entity_ids:
                    network_context = await self.graph_queries.get_entity_network_context(entity_ids)
                    entity_networks.append(network_context)
            except Exception as e:
                print(f"   ⚠️ Failed to get entities for event {event['id']}: {e}")
        
        # Step 3: Build relationship graph
        print(f"   🔗 Building relationship graph...")
        relationship_graph = {
            "entities": all_entities,
            "networks": entity_networks,
            "cross_references": self._find_cross_references(primary_events, entity_networks)
        }
        
        # Step 4: Find historical analogues
        historical_analogues = []
        if include_historical_analogues:
            print(f"   🔍 Searching for historical analogues...")
            for event in primary_events[:3]:  # Limit to first 3 events to avoid token overflow
                try:
                    event_text = f"{event['title']} {event['summary']}"
                    analogues = await self.graph_queries.find_historical_analogues(event_text, limit=5)
                    historical_analogues.extend(analogues)
                except Exception as e:
                    print(f"   ⚠️ Failed to find analogues for event {event['id']}: {e}")
        
        # Step 5: Build causal chains (simplified for now)
        causal_chains = []
        if include_causal_chains:
            print(f"   ⛓️  Analyzing causal relationships...")
            causal_chains = await self._build_causal_chains(primary_events, all_entities)
        
        # Calculate context size for cost tracking
        context_size_tokens = self._estimate_token_count(
            primary_events, all_entities, historical_analogues, causal_chains
        )
        
        assembly_time = int((time.time() - start_time) * 1000)
        
        return AnalysisContext(
            primary_events=primary_events,
            entity_neighborhood=all_entities,
            historical_analogues=historical_analogues,
            causal_chains=causal_chains,
            relationship_graph=relationship_graph,
            context_size_tokens=context_size_tokens,
            graph_query_time_ms=assembly_time
        )
    
    def _find_cross_references(
        self, 
        events: List[Dict], 
        networks: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Find entities referenced across multiple events."""
        entity_connections = {}
        
        for network in networks:
            for entity in network.get("entities", []):
                entity_id = entity["id"]
                if entity_id not in entity_connections:
                    entity_connections[entity_id] = {
                        "entity": entity,
                        "events": set()
                    }
                entity_connections[entity_id]["events"].add(entity.get("event_context", ""))
        
        # Find entities that appear in multiple events
        cross_references = []
        for entity_id, data in entity_connections.items():
            if len(data["events"]) > 1:
                cross_references.append({
                    "entity": data["entity"],
                    "connected_events": list(data["events"]),
                    "connection_strength": len(data["events"])
                })
        
        # Sort by connection strength
        return sorted(cross_references, key=lambda x: x["connection_strength"], reverse=True)
    
    async def _build_causal_chains(
        self, 
        events: List[Dict], 
        entities: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Build simplified causal chains between events."""
        causal_chains = []
        
        # This is a simplified implementation
        # In a full implementation, this would query Neo4j for temporal relationships
        
        for i, event in enumerate(events):
            for j, other_event in enumerate(events):
                if i != j:
                    # Look for shared entities as potential causal links
                    event_entities = set(e["id"] for e in entities if e.get("event_context") == event["id"])
                    other_entities = set(e["id"] for e in entities if e.get("event_context") == other_event["id"])
                    
                    shared_entities = event_entities.intersection(other_entities)
                    
                    if shared_entities:
                        # Check temporal ordering
                        try:
                            event_time = event["timestamp"]
                            other_time = other_event["timestamp"]
                            
                            if event_time < other_time:
                                causal_chains.append({
                                    "cause_event": event,
                                    "effect_event": other_event,
                                    "shared_entities": list(shared_entities),
                                    "relationship_strength": len(shared_entities)
                                })
                        except (KeyError, TypeError):
                            continue
        
        return causal_chains[:10]  # Limit to top 10 causal chains
    
    def _estimate_token_count(
        self, 
        events: List[Dict], 
        entities: List[Dict], 
        analogues: List[Dict], 
        causal_chains: List[Dict]
    ) -> int:
        """Estimate token count for cost tracking."""
        
        # Rough estimation: 1 token ≈ 4 characters
        total_chars = 0
        
        # Events
        for event in events:
            total_chars += len(str(event.get("title", "")))
            total_chars += len(str(event.get("summary", "")))
        
        # Entities
        for entity in entities:
            total_chars += len(str(entity.get("name", "")))
            total_chars += len(str(entity.get("description", "")))
        
        # Analogues
        for analogue in analogues:
            total_chars += len(str(analogue.get("title", "")))
            total_chars += len(str(analogue.get("summary", "")))
        
        # Causal chains
        for chain in causal_chains:
            total_chars += len(str(chain))
        
        return total_chars // 4  # Convert to rough token estimate