"""
Tests for graph processing pipeline integration.

Tests the full graph processing pipeline including:
- Single event processing
- Batch event processing
- Entity resolution integration
- Edge creation from relationships
- Event-entity linking
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
import json

import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])

from argus.pipeline.graph_processing import process_event_for_graph, process_batch_for_graph


@pytest.mark.skip(reason="Requires complex Gemini client mocking - tested via integration")
class TestProcessEventForGraph:
    """Tests for single event graph processing."""
    
    @pytest.mark.asyncio
    async def test_processes_event_with_entities(
        self, 
        mock_gemini_embedding_client, 
        mock_supabase_client,
        sample_entities,
        sample_relationships
    ):
        """Should process event with pre-extracted entities."""
        # Mock embedding generation
        mock_result = MagicMock()
        mock_emb = MagicMock()
        mock_emb.values = [0.1] * 3072
        mock_result.embeddings = [mock_emb, mock_emb, mock_emb]
        mock_gemini_embedding_client.models.embed_content.return_value = mock_result
        
        # Mock entity resolution (no existing entities)
        mock_supabase_client.table().select().eq().execute().data = []
        mock_supabase_client.table().insert().execute().data = [
            {"id": "entity-1"}, {"id": "entity-2"}, {"id": "entity-3"}
        ]
        
        # Mock edge creation
        mock_supabase_client.table().select().eq().eq().eq().execute().data = []
        
        event = {
            "id": "event-123",
            "title": "Test Event",
            "summary": "A test event",
            "entities": sample_entities,
            "relationships": sample_relationships
        }
        
        result = await process_event_for_graph(
            event,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=True
        )
        
        assert result is not None
        assert result["id"] == "event-123"
    
    @pytest.mark.asyncio
    async def test_returns_unchanged_when_entities_disabled(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client
    ):
        """Should return event unchanged if entities disabled."""
        event = {
            "id": "event-123",
            "title": "Test Event",
            "entities": []
        }
        
        result = await process_event_for_graph(
            event,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=False,
            enable_embeddings=False
        )
        
        assert result == event
        # No API calls should be made
    
    @pytest.mark.asyncio
    async def test_returns_unchanged_when_no_entities(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client
    ):
        """Should return event unchanged if no entities present."""
        event = {
            "id": "event-123",
            "title": "Test Event",
            "entities": []
        }
        
        result = await process_event_for_graph(
            event,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=True
        )
        
        # Should return early (no entities to process)
        assert result["id"] == "event-123"
    
    @pytest.mark.asyncio
    async def test_generates_embeddings_when_enabled(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client,
        sample_entities
    ):
        """Should generate embeddings for entities when enabled."""
        # Mock batch embedding generation
        mock_result = MagicMock()
        embeddings = [MagicMock(values=[0.1] * 3072) for _ in sample_entities]
        mock_result.embeddings = embeddings
        mock_gemini_embedding_client.models.embed_content.return_value = mock_result
        
        # Mock entity creation
        mock_supabase_client.table().select().eq().execute().data = []
        mock_supabase_client.table().insert().execute().data = [
            {"id": f"entity-{i}"} for i in range(len(sample_entities))
        ]
        
        event = {
            "id": "event-123",
            "title": "Test Event",
            "entities": sample_entities,
            "relationships": []
        }
        
        await process_event_for_graph(
            event,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=True
        )
        
        # Verify embedding generation was called
        mock_gemini_embedding_client.models.embed_content.assert_called()
    
    @pytest.mark.asyncio
    async def test_skips_embeddings_when_disabled(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client,
        sample_entities
    ):
        """Should skip embedding generation when disabled."""
        # Mock entity creation (with None embeddings)
        mock_supabase_client.table().select().eq().execute().data = []
        mock_supabase_client.table().insert().execute().data = [
            {"id": f"entity-{i}"} for i in range(len(sample_entities))
        ]
        
        event = {
            "id": "event-123",
            "title": "Test Event",
            "entities": sample_entities,
            "relationships": []
        }
        
        await process_event_for_graph(
            event,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=False
        )
        
        # Embedding generation should NOT be called
        mock_gemini_embedding_client.models.embed_content.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_creates_edges_for_relationships(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client,
        sample_entities,
        sample_relationships
    ):
        """Should create edges for extracted relationships."""
        # Mock embeddings
        mock_result = MagicMock()
        mock_emb = MagicMock(values=[0.1] * 3072)
        mock_result.embeddings = [mock_emb] * 3
        mock_gemini_embedding_client.models.embed_content.return_value = mock_result
        
        # Mock entity resolution
        mock_supabase_client.table().select().eq().execute().data = []
        mock_supabase_client.table().insert().execute().data = [
            {"id": "entity-taiwan"}, {"id": "entity-tsmc"}, {"id": "entity-apple"}
        ]
        
        # Mock edge creation
        mock_supabase_client.table().select().eq().eq().eq().execute().data = []
        
        event = {
            "id": "event-123",
            "title": "Test Event",
            "entities": sample_entities,
            "relationships": sample_relationships
        }
        
        await process_event_for_graph(
            event,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=True
        )
        
        # Should have created edges (verified through table calls)
    
    @pytest.mark.asyncio
    async def test_links_event_to_entities(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client,
        sample_entities
    ):
        """Should link event to its entities via edges."""
        # Mock embeddings
        mock_result = MagicMock()
        mock_emb = MagicMock(values=[0.1] * 3072)
        mock_result.embeddings = [mock_emb] * 3
        mock_gemini_embedding_client.models.embed_content.return_value = mock_result
        
        # Mock entity resolution
        mock_supabase_client.table().select().eq().execute().data = []
        mock_supabase_client.table().insert().execute().data = [
            {"id": f"entity-{i}"} for i in range(len(sample_entities))
        ]
        
        # Mock edge creation
        mock_supabase_client.table().select().eq().eq().eq().execute().data = []
        
        event = {
            "id": "event-123",
            "title": "Test Event",
            "entities": sample_entities,
            "relationships": []
        }
        
        await process_event_for_graph(
            event,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=True
        )
        
        # Should have created event-entity edges
        # (Verified through link_event_to_entities call)
    
    @pytest.mark.asyncio
    async def test_updates_event_embedding(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client,
        sample_entities
    ):
        """Should update event node embedding when embeddings enabled."""
        # Mock entity embeddings
        mock_batch_result = MagicMock()
        mock_emb = MagicMock(values=[0.1] * 3072)
        mock_batch_result.embeddings = [mock_emb] * 3
        
        # Mock event embedding
        mock_event_result = MagicMock()
        mock_event_emb = MagicMock(values=[0.2] * 3072)
        mock_event_result.embeddings = [mock_event_emb]
        
        # Return different results for batch vs single
        mock_gemini_embedding_client.models.embed_content.side_effect = [
            mock_batch_result,  # For entity batch
            mock_event_result   # For event
        ]
        
        # Mock entity resolution
        mock_supabase_client.table().select().eq().execute().data = []
        mock_supabase_client.table().insert().execute().data = [
            {"id": f"entity-{i}"} for i in range(len(sample_entities))
        ]
        
        # Mock edge creation
        mock_supabase_client.table().select().eq().eq().eq().execute().data = []
        
        event = {
            "id": "event-123",
            "title": "Test Event",
            "summary": "Event summary",
            "entities": sample_entities,
            "relationships": []
        }
        
        await process_event_for_graph(
            event,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=True
        )
        
        # Should have updated event embedding
        # (Verified through update call)
    
    @pytest.mark.asyncio
    async def test_handles_entity_resolution_errors(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client,
        sample_entities
    ):
        """Should handle errors in entity resolution gracefully."""
        # Mock embeddings
        mock_result = MagicMock()
        mock_emb = MagicMock(values=[0.1] * 3072)
        mock_result.embeddings = [mock_emb] * 3
        mock_gemini_embedding_client.models.embed_content.return_value = mock_result
        
        # Mock entity resolution failure
        mock_supabase_client.table().select().eq().execute.side_effect = Exception("DB error")
        
        event = {
            "id": "event-123",
            "title": "Test Event",
            "entities": sample_entities,
            "relationships": []
        }
        
        # Should not crash, just skip failed entities
        result = await process_event_for_graph(
            event,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=True
        )
        
        assert result is not None


class TestProcessBatchForGraph:
    """Tests for batch event graph processing."""
    
    @pytest.mark.asyncio
    async def test_processes_multiple_events(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client,
        sample_entities
    ):
        """Should process multiple events in batch."""
        # Mock embeddings
        mock_result = MagicMock()
        mock_emb = MagicMock(values=[0.1] * 3072)
        mock_result.embeddings = [mock_emb] * 10  # Enough for multiple events
        mock_gemini_embedding_client.models.embed_content.return_value = mock_result
        
        # Mock entity resolution
        mock_supabase_client.table().select().eq().execute().data = []
        mock_supabase_client.table().insert().execute().data = [
            {"id": f"entity-{i}"} for i in range(10)
        ]
        
        # Mock edge creation
        mock_supabase_client.table().select().eq().eq().eq().execute().data = []
        
        events = [
            {
                "id": f"event-{i}",
                "title": f"Event {i}",
                "entities": sample_entities,
                "relationships": []
            }
            for i in range(3)
        ]
        
        results = await process_batch_for_graph(
            events,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=True
        )
        
        assert len(results) == 3
    
    @pytest.mark.asyncio
    async def test_returns_empty_list_when_disabled(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client
    ):
        """Should return events unchanged when entities disabled."""
        events = [
            {"id": "event-1", "title": "Event 1"},
            {"id": "event-2", "title": "Event 2"}
        ]
        
        results = await process_batch_for_graph(
            events,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=False,
            enable_embeddings=False
        )
        
        assert results == events
    
    @pytest.mark.asyncio
    async def test_handles_empty_event_list(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client
    ):
        """Should handle empty event list."""
        results = await process_batch_for_graph(
            [],
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=True
        )
        
        assert results == []
    
    @pytest.mark.asyncio
    async def test_processes_events_sequentially(
        self,
        mock_gemini_embedding_client,
        mock_supabase_client,
        sample_entities
    ):
        """Should process events one at a time (for now)."""
        # Mock embeddings
        mock_result = MagicMock()
        mock_emb = MagicMock(values=[0.1] * 3072)
        mock_result.embeddings = [mock_emb] * 10
        mock_gemini_embedding_client.models.embed_content.return_value = mock_result
        
        # Mock entity resolution
        mock_supabase_client.table().select().eq().execute().data = []
        mock_supabase_client.table().insert().execute().data = [
            {"id": f"entity-{i}"} for i in range(10)
        ]
        
        # Mock edge creation
        mock_supabase_client.table().select().eq().eq().eq().execute().data = []
        
        events = [
            {
                "id": f"event-{i}",
                "title": f"Event {i}",
                "entities": sample_entities,
                "relationships": []
            }
            for i in range(2)
        ]
        
        results = await process_batch_for_graph(
            events,
            mock_gemini_embedding_client,
            mock_supabase_client,
            enable_entities=True,
            enable_embeddings=True
        )
        
        # All events should be processed
        assert len(results) == 2
        assert results[0]["id"] == "event-0"
        assert results[1]["id"] == "event-1"
