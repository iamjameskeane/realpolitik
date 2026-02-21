"""Mnemosyne - Qdrant client for vector search and embeddings"""

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from typing import List, Optional, Dict, Any
import structlog

logger = structlog.get_logger()


class MnemosyneClient:
    """Qdrant client for vector embeddings and semantic search"""
    
    def __init__(self, host: str = "localhost", port: int = 6333):
        self.host = host
        self.port = port
        self.client = None
    
    async def connect(self):
        """Establish Qdrant connection"""
        try:
            self.client = QdrantClient(host=self.host, port=self.port)
            # Test connection
            self.client.get_collections()
            logger.info("Mnemosyne connection established")
        except Exception as e:
            logger.error("Failed to connect to Mnemosyne", error=str(e))
            raise
    
    async def disconnect(self):
        """Close Qdrant connection"""
        # Qdrant client doesn't need explicit disconnect for HTTP
        logger.info("Mnemosyne connection closed")
    
    async def insert_event_embedding(
        self,
        collection_name: str,
        event_id: str,
        embedding: List[float],
        event_data: Dict[str, Any]
    ):
        """Insert event embedding with metadata"""
        try:
            # Ensure collection exists
            collections = self.client.get_collections()
            collection_names = [col.name for col in collections.collections]
            
            if collection_name not in collection_names:
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=len(embedding), distance=Distance.COSINE)
                )
                logger.info("Created collection", collection_name=collection_name)
            
            # Insert point
            point = PointStruct(
                id=event_id,
                vector=embedding,
                payload={
                    "event_id": event_id,
                    "title": event_data.get("title", ""),
                    "category": event_data.get("category", ""),
                    "severity": event_data.get("severity", ""),
                    "occurred_at": event_data.get("occurred_at"),
                    "primary_location": event_data.get("primary_location", ""),
                    "summary": event_data.get("summary", "")
                }
            )
            
            self.client.upsert(
                collection_name=collection_name,
                points=[point]
            )
            
            logger.info("Event embedding inserted", event_id=event_id, collection=collection_name)
            
        except Exception as e:
            logger.error("Failed to insert embedding", error=str(e))
            raise
    
    async def search_similar_events(
        self,
        collection_name: str,
        query_embedding: List[float],
        limit: int = 5,
        score_threshold: float = 0.7,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar events using embeddings"""
        try:
            search_result = self.client.search(
                collection_name=collection_name,
                query_vector=query_embedding,
                limit=limit,
                score_threshold=score_threshold,
                query_filter=filters
            )
            
            similar_events = []
            for result in search_result:
                similar_events.append({
                    'event_id': result.id,
                    'score': result.score,
                    'metadata': result.payload
                })
            
            logger.info("Found similar events", count=len(similar_events), collection=collection_name)
            return similar_events
            
        except Exception as e:
            logger.error("Failed to search similar events", error=str(e))
            return []
    
    async def test_connection(self) -> bool:
        """Test Qdrant connection"""
        try:
            self.client.get_collections()
            return True
        except Exception as e:
            logger.error("Connection test failed", error=str(e))
            return False
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()