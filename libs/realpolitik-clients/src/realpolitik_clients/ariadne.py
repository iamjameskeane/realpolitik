"""Ariadne - Neo4j client for knowledge graph operations"""

from neo4j import AsyncGraphDatabase
from typing import List, Optional, Dict, Any
import structlog

logger = structlog.get_logger()


class AriadneClient:
    """Neo4j client for graph relationships and entity traversal"""
    
    def __init__(self, uri: str, username: str, password: str):
        self.uri = uri
        self.username = username
        self.password = password
        self.driver = None
    
    async def connect(self):
        """Establish Neo4j connection"""
        try:
            self.driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.username, self.password)
            )
            await self.driver.verify_connectivity()
            logger.info("Ariadne connection established")
        except Exception as e:
            logger.error("Failed to connect to Ariadne", error=str(e))
            raise
    
    async def disconnect(self):
        """Close Neo4j connection"""
        if self.driver:
            await self.driver.close()
            logger.info("Ariadne connection closed")
    
    async def create_event_node(self, event_data: Dict[str, Any]):
        """Create event node in graph"""
        async with self.driver.session() as session:
            try:
                query = """
                    CREATE (e:Event {
                        id: $event_id,
                        title: $title,
                        category: $category,
                        severity: $severity,
                        occurred_at: $occurred_at,
                        primary_location: $primary_location,
                        confidence_score: $confidence_score
                    })
                    RETURN e
                """
                
                result = await session.run(query, **event_data)
                record = await result.single()
                logger.info("Event node created", event_id=event_data['id'])
                return record['e']
                
            except Exception as e:
                logger.error("Failed to create event node", error=str(e))
                raise
    
    async def find_entity_neighbors(
        self,
        entity_id: str,
        max_depth: int = 2
    ) -> List[Dict[str, Any]]:
        """Find entity neighbors within specified depth"""
        async with self.driver.session() as session:
            try:
                query = f"""
                    MATCH (e:Entity {{id: $entity_id}})
                    CALL {{
                        WITH e
                        MATCH p=(e)-[*1..{max_depth}]-(neighbor)
                        WHERE neighbor.id IS NOT NULL
                        RETURN p, neighbor, length(p) as depth
                        ORDER BY depth
                        LIMIT 20
                    }}
                    RETURN neighbor, depth, relationships(p) as rels
                """
                
                result = await session.run(query, entity_id=entity_id)
                neighbors = []
                
                async for record in result:
                    neighbors.append({
                        'entity': dict(record['neighbor']),
                        'depth': record['depth'],
                        'relationships': [dict(rel) for rel in record['rels']]
                    })
                
                logger.info("Found neighbors", entity_id=entity_id, count=len(neighbors))
                return neighbors
                
            except Exception as e:
                logger.error("Failed to find neighbors", error=str(e))
                return []
    
    async def find_event_causes(self, event_id: str) -> List[Dict[str, Any]]:
        """Find causal chain for an event"""
        async with self.driver.session() as session:
            try:
                query = """
                    MATCH (e:Event {id: $event_id})
                    OPTIONAL MATCH path = (cause)-[:LEADS_TO*1..3]->(e)
                    WITH nodes(path) as causes, length(path) as depth
                    UNWIND causes as cause
                    RETURN DISTINCT cause, depth
                    ORDER BY depth
                """
                
                result = await session.run(query, event_id=event_id)
                causes = []
                
                async for record in result:
                    causes.append({
                        'event': dict(record['cause']),
                        'distance': record['depth']
                    })
                
                logger.info("Found causal chain", event_id=event_id, count=len(causes))
                return causes
                
            except Exception as e:
                logger.error("Failed to find causal chain", error=str(e))
                return []
    
    async def test_connection(self) -> bool:
        """Test Neo4j connection"""
        try:
            async with self.driver.session() as session:
                await session.run("RETURN 1")
            return True
        except Exception as e:
            logger.error("Connection test failed", error=str(e))
            return False
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()