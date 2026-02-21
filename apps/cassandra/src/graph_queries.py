"""
Graph database queries for Cassandra microservice.
"""

import json
import hashlib
from typing import List, Dict, Optional, Any
import asyncio
import aiohttp
import asyncpg
from neo4j import AsyncGraphDatabase
from qdrant_client import QdrantClient
from qdrant_client.http import models


class GraphQueries:
    """Graph database operations for Cassandra."""
    
    def __init__(self, neo4j_uri: str, neo4j_username: str, neo4j_password: str, 
                 qdrant_uri: str, database_url: str):
        self.neo4j_uri = neo4j_uri
        self.neo4j_username = neo4j_username
        self.neo4j_password = neo4j_password
        self.qdrant_uri = qdrant_uri
        self.database_url = database_url
        
        # Initialize clients lazily
        self._neo4j_driver = None
        self._qdrant_client = None
        self._pg_pool = None
    
    async def get_neo4j_driver(self):
        """Get Neo4j driver."""
        if self._neo4j_driver is None:
            self._neo4j_driver = AsyncGraphDatabase.driver(
                self.neo4j_uri,
                auth=(self.neo4j_username, self.neo4j_password)
            )
        return self._neo4j_driver
    
    async def get_qdrant_client(self):
        """Get Qdrant client."""
        if self._qdrant_client is None:
            self._qdrant_client = QdrantClient(url=self.qdrant_uri)
        return self._qdrant_client
    
    async def get_pg_pool(self):
        """Get PostgreSQL connection pool."""
        if self._pg_pool is None:
            self._pg_pool = await asyncpg.create_pool(self.database_url)
        return self._pg_pool
    
    async def get_event_entities(self, event_id: str) -> List[Dict[str, Any]]:
        """
        Get all entities linked to a specific event.
        
        Args:
            event_id: Event UUID to get entities for
            
        Returns:
            List of entity dictionaries
        """
        driver = await self.get_neo4j_driver()
        async with driver.session() as session:
            result = await session.run("""
                MATCH (e:Event {id: $event_id})<-[:INVOLVES]-(entity:Entity)
                RETURN entity, labels(entity) as entity_types
                ORDER BY entity.confidence DESC
            """, event_id=event_id)
            
            entities = []
            async for record in result:
                entity = dict(record["entity"])
                entity["types"] = record["entity_types"]
                entities.append(entity)
            
            return entities
    
    async def get_entity_relationships(self, entity_id: str, max_depth: int = 2) -> List[Dict[str, Any]]:
        """
        Get relationships for an entity within specified depth.
        
        Args:
            entity_id: Entity UUID
            max_depth: Maximum relationship traversal depth
            
        Returns:
            List of relationship dictionaries
        """
        driver = await self.get_neo4j_driver()
        async with driver.session() as session:
            # Get relationships within specified depth
            result = await session.run("""
                MATCH (e:Entity {id: $entity_id})-[r*1..$max_depth]-(related:Entity)
                RETURN 
                    e.id as source_id,
                    related.id as target_id,
                    related.name as target_name,
                    type(r[0]) as relationship_type,
                    r[0].confidence as confidence,
                    r[0].percentage as percentage,
                    r[0].polarity as polarity,
                    related.types as target_types
                ORDER BY confidence DESC
                LIMIT 50
            """, entity_id=entity_id, max_depth=max_depth)
            
            relationships = []
            async for record in result:
                rel = {
                    "source_id": record["source_id"],
                    "target_id": record["target_id"],
                    "target_name": record["target_name"],
                    "relationship_type": record["relationship_type"],
                    "confidence": record["confidence"] or 0.0,
                    "percentage": record["percentage"] or 0.0,
                    "polarity": record["polarity"] or "neutral",
                    "target_types": record["target_types"]
                }
                relationships.append(rel)
            
            return relationships
    
    async def find_historical_analogues(
        self, 
        event_text: str, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find historically similar events using vector similarity.
        
        Args:
            event_text: Event description for similarity search
            limit: Maximum number of results
            
        Returns:
            List of similar events with similarity scores
        """
        client = await self.get_qdrant_client()
        
        try:
            # Search in the events collection
            search_results = client.search(
                collection_name="geopolitical_events",
                query_text=event_text,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )
            
            analogues = []
            for result in search_results:
                analogue = {
                    "event_id": result.id,
                    "similarity_score": result.score,
                    "title": result.payload.get("title", ""),
                    "summary": result.payload.get("summary", ""),
                    "category": result.payload.get("category", ""),
                    "location_name": result.payload.get("location_name", ""),
                    "timestamp": result.payload.get("timestamp", ""),
                    "fallout_prediction": result.payload.get("fallout_prediction", "")
                }
                analogues.append(analogue)
            
            return analogues
            
        except Exception as e:
            print(f"   ⚠️ Vector search failed: {e}")
            return []
    
    async def get_event_network_graph(self, event_id: str, include_indirect: bool = True) -> Dict[str, Any]:
        """
        Get the complete network graph around an event.
        
        Args:
            event_id: Event UUID
            include_indirect: Whether to include 2-hop relationships
            
        Returns:
            Complete graph structure for the event
        """
        driver = await self.get_neo4j_driver()
        async with driver.session() as session:
            # Get direct entities
            direct_entities_result = await session.run("""
                MATCH (e:Event {id: $event_id})<-[:INVOLVES]-(entity:Entity)
                RETURN entity, labels(entity) as entity_types
                ORDER BY entity.confidence DESC
            """, event_id=event_id)
            
            direct_entities = []
            async for record in direct_entities_result:
                entity = dict(record["entity"])
                entity["types"] = record["entity_types"]
                direct_entities.append(entity)
            
            if not direct_entities:
                return {"entities": [], "relationships": [], "paths": []}
            
            entity_ids = [e["id"] for e in direct_entities]
            
            # Get direct relationships between entities
            relationships_result = await session.run("""
                MATCH (e1:Entity)-[r]-(e2:Entity)
                WHERE e1.id IN $entity_ids AND e2.id IN $entity_ids
                RETURN 
                    e1.id as source_id,
                    e1.name as source_name,
                    e2.id as target_id,
                    e2.name as target_name,
                    type(r) as relationship_type,
                    r.confidence as confidence,
                    r.percentage as percentage,
                    r.polarity as polarity,
                    r.evidence_level as evidence_level
                ORDER BY confidence DESC
            """, entity_ids=entity_ids)
            
            direct_relationships = []
            async for record in relationships_result:
                rel = {
                    "source_id": record["source_id"],
                    "source_name": record["source_name"],
                    "target_id": record["target_id"],
                    "target_name": record["target_name"],
                    "relationship_type": record["relationship_type"],
                    "confidence": record["confidence"] or 0.0,
                    "percentage": record["percentage"] or 0.0,
                    "polarity": record["polarity"] or "neutral",
                    "evidence_level": record["evidence_level"] or "low"
                }
                direct_relationships.append(rel)
            
            # Optionally get indirect relationships
            indirect_relationships = []
            if include_indirect:
                indirect_result = await session.run("""
                    MATCH (e1:Entity)-[r1]-(intermediate:Entity)-[r2]-(e2:Entity)
                    WHERE e1.id IN $direct_ids 
                    AND e2.id NOT IN $direct_ids
                    AND intermediate.id NOT IN $direct_ids
                    RETURN 
                        e1.id as source_id,
                        e1.name as source_name,
                        intermediate.id as intermediate_id,
                        intermediate.name as intermediate_name,
                        e2.id as target_id,
                        e2.name as target_name,
                        type(r1) as first_relationship,
                        type(r2) as second_relationship,
                        r1.confidence as first_confidence,
                        r2.confidence as second_confidence
                    ORDER BY (r1.confidence + r2.confidence) / 2 DESC
                    LIMIT 20
                """, direct_ids=entity_ids)
                
                async for record in indirect_result:
                    indirect_rel = {
                        "source_id": record["source_id"],
                        "source_name": record["source_name"],
                        "intermediate_id": record["intermediate_id"],
                        "intermediate_name": record["intermediate_name"],
                        "target_id": record["target_id"],
                        "target_name": record["target_name"],
                        "path": f"{record['first_relationship']} -> {record['second_relationship']}",
                        "confidence": (record["first_confidence"] + record["second_confidence"]) / 2
                    }
                    indirect_relationships.append(indirect_rel)
            
            # Get hub entities (high degree nodes)
            hub_result = await session.run("""
                MATCH (e:Entity)-[r]-(connected:Entity)
                WHERE e.id IN $entity_ids
                RETURN 
                    e.id as entity_id,
                    e.name as entity_name,
                    count(connected) as degree,
                    labels(e) as entity_types
                ORDER BY degree DESC
                LIMIT 5
            """, entity_ids=entity_ids)
            
            hub_entities = []
            async for record in hub_result:
                hub = {
                    "entity_id": record["entity_id"],
                    "entity_name": record["entity_name"],
                    "degree": record["degree"],
                    "types": record["entity_types"]
                }
                hub_entities.append(hub)
            
            return {
                "entities": direct_entities,
                "direct_relationships": direct_relationships,
                "indirect_relationships": indirect_relationships,
                "hub_entities": hub_entities,
                "graph_stats": {
                    "direct_entities": len(direct_entities),
                    "direct_relationships": len(direct_relationships),
                    "indirect_relationships": len(indirect_relationships),
                    "hub_entities": len(hub_entities)
                }
            }
    
    async def get_entity_network_context(self, entity_ids: List[str]) -> Dict[str, Any]:
        """
        Get comprehensive context for a list of entities.
        
        Args:
            entity_ids: List of entity UUIDs
            
        Returns:
            Entity network context
        """
        driver = await self.get_neo4j_driver()
        async with driver.session() as session:
            # Get entity details and relationships
            result = await session.run("""
                MATCH (e:Entity)-[r]-(connected:Entity)
                WHERE e.id IN $entity_ids
                RETURN 
                    e.id as entity_id,
                    e.name as entity_name,
                    e.entity_type as entity_type,
                    e.country as country,
                    e.description as description,
                    connected.id as connected_id,
                    connected.name as connected_name,
                    connected.entity_type as connected_type,
                    type(r) as relationship_type,
                    r.confidence as confidence,
                    r.percentage as percentage,
                    r.polarity as polarity
                ORDER BY confidence DESC
                LIMIT 100
            """, entity_ids=entity_ids)
            
            entities = {}
            relationships = []
            
            async for record in result:
                entity_id = record["entity_id"]
                connected_id = record["connected_id"]
                
                # Add entities
                if entity_id not in entities:
                    entities[entity_id] = {
                        "id": entity_id,
                        "name": record["entity_name"],
                        "type": record["entity_type"],
                        "country": record["country"],
                        "description": record["description"],
                        "connections": 0
                    }
                
                if connected_id not in entities:
                    entities[connected_id] = {
                        "id": connected_id,
                        "name": record["connected_name"],
                        "type": record["connected_type"],
                        "country": None,
                        "description": None,
                        "connections": 0
                    }
                
                # Add relationship
                relationship = {
                    "source_id": entity_id,
                    "target_id": connected_id,
                    "source_name": record["entity_name"],
                    "target_name": record["connected_name"],
                    "relationship_type": record["relationship_type"],
                    "confidence": record["confidence"] or 0.0,
                    "percentage": record["percentage"] or 0.0,
                    "polarity": record["polarity"] or "neutral"
                }
                relationships.append(relationship)
                
                # Update connection counts
                entities[entity_id]["connections"] += 1
                entities[connected_id]["connections"] += 1
            
            # Calculate network statistics
            hub_entities = sorted(
                entities.values(),
                key=lambda x: x["connections"],
                reverse=True
            )[:10]
            
            return {
                "entities": list(entities.values()),
                "relationships": relationships,
                "hub_entities": hub_entities,
                "network_stats": {
                    "total_entities": len(entities),
                    "total_relationships": len(relationships),
                    "network_density": len(relationships) / max(len(entities) * (len(entities) - 1) / 2, 1)
                }
            }