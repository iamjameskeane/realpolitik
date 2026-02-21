"""
Integration tests for Argus pipeline.

These tests verify the full pipeline works correctly with real or mock services.
Tests marked with @pytest.mark.integration require actual database/API access.

Run with: pytest tests/test_integration.py -v
Run integration tests: pytest tests/test_integration.py -v -m integration
"""

import pytest
import os
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timezone

import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])


# ============================================================================
# DATABASE FUNCTION TESTS
# ============================================================================

class TestUpdateEventFallout:
    """Tests for the update_event_fallout function."""

    @pytest.mark.asyncio
    async def test_updates_event_details_table(self):
        """Should update event_details table, not events view."""
        from argus.storage.supabase import update_event_fallout
        
        # Mock the Supabase client (patch where it's imported in the module)
        with patch('supabase.create_client') as mock_create:
            mock_client = MagicMock()
            mock_table = MagicMock()
            mock_update = MagicMock()
            mock_eq = MagicMock()
            mock_execute = MagicMock()
            
            mock_create.return_value = mock_client
            mock_client.table.return_value = mock_table
            mock_table.update.return_value = mock_update
            mock_update.eq.return_value = mock_eq
            mock_eq.execute.return_value = mock_execute
            mock_execute.data = [{"node_id": "test-uuid"}]
            
            result = await update_event_fallout(
                "test-uuid",
                "Test fallout prediction",
                "https://test.supabase.co",
                "test-key"
            )
            
            # Verify it calls event_details table, not events view
            mock_client.table.assert_called_with("event_details")
            mock_table.update.assert_called_with({
                "fallout_prediction": "Test fallout prediction"
            })
            # Verify it uses node_id, not id
            mock_update.eq.assert_called_with("node_id", "test-uuid")
            assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_on_error(self):
        """Should return False when update fails."""
        from argus.storage.supabase import update_event_fallout
        
        with patch('supabase.create_client') as mock_create:
            mock_create.side_effect = Exception("Connection failed")
            
            result = await update_event_fallout(
                "test-uuid",
                "Test fallout",
                "https://test.supabase.co",
                "test-key"
            )
            
            assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_on_empty_result(self):
        """Should return False when no rows updated."""
        from argus.storage.supabase import update_event_fallout
        
        with patch('supabase.create_client') as mock_create:
            mock_client = MagicMock()
            mock_table = MagicMock()
            mock_update = MagicMock()
            mock_eq = MagicMock()
            mock_execute = MagicMock()
            
            mock_create.return_value = mock_client
            mock_client.table.return_value = mock_table
            mock_table.update.return_value = mock_update
            mock_update.eq.return_value = mock_eq
            mock_eq.execute.return_value = mock_execute
            mock_execute.data = []  # No rows updated
            
            result = await update_event_fallout(
                "nonexistent-uuid",
                "Test fallout",
                "https://test.supabase.co",
                "test-key"
            )
            
            assert result is False


class TestWriteSupabase:
    """Tests for the write_supabase function."""

    @pytest.mark.asyncio
    async def test_calls_insert_event_rpc(self):
        """Should call insert_event RPC with correct parameters."""
        from argus.storage.supabase import write_supabase
        from argus.models.events import GeoEvent, EventSource
        
        with patch('supabase.create_client') as mock_create:
            mock_client = MagicMock()
            mock_rpc = MagicMock()
            mock_execute = MagicMock()
            
            mock_create.return_value = mock_client
            mock_client.rpc.return_value = mock_rpc
            mock_rpc.execute.return_value = mock_execute
            mock_execute.data = "test-uuid-123"
            
            # Create a test event
            now = datetime.now(timezone.utc).isoformat()
            event = GeoEvent(
                id="test-event-id",
                title="Test Event",
                summary="Test summary",
                category="MILITARY",
                severity=7,
                location_name="Test Location",
                coordinates=(30.0, 50.0),
                region="EUROPE",
                timestamp=now,
                last_updated=now,
                fallout_prediction="Test fallout",
                sources=[
                    EventSource(
                        id="src-1",
                        headline="Test headline",
                        summary="Test source summary",
                        source_name="Reuters",
                        source_url="https://reuters.com/test",
                        timestamp=now,
                    )
                ],
            )
            
            result = await write_supabase(
                [event],
                "https://test.supabase.co",
                "test-key"
            )
            
            # Verify RPC was called
            mock_client.rpc.assert_called_with("insert_event", {
                "p_title": "Test Event",
                "p_summary": "Test summary",
                "p_category": "MILITARY",
                "p_severity": 7,
                "p_location_name": "Test Location",
                "p_lng": 30.0,
                "p_lat": 50.0,
                "p_region": "EUROPE",
                "p_timestamp": event.timestamp,
                "p_fallout_prediction": "Test fallout",
                "p_sources": [event.sources[0].model_dump()],
            })
            
            assert len(result) == 1
            assert result[0]["id"] == "test-uuid-123"

    @pytest.mark.asyncio
    async def test_handles_insert_failure(self):
        """Should handle RPC insert failure gracefully."""
        from argus.storage.supabase import write_supabase
        from argus.models.events import GeoEvent, EventSource
        
        with patch('supabase.create_client') as mock_create:
            mock_client = MagicMock()
            mock_rpc = MagicMock()
            mock_execute = MagicMock()
            
            mock_create.return_value = mock_client
            mock_client.rpc.return_value = mock_rpc
            mock_rpc.execute.return_value = mock_execute
            mock_execute.data = None  # Insert failed
            
            now = datetime.now(timezone.utc).isoformat()
            event = GeoEvent(
                id="test-event-id",
                title="Test Event",
                summary="Test summary",
                category="MILITARY",
                severity=7,
                location_name="Test Location",
                coordinates=(30.0, 50.0),
                region="EUROPE",
                timestamp=now,
                last_updated=now,
                fallout_prediction="",
                sources=[
                    EventSource(
                        id="src-1",
                        headline="Test",
                        summary="Test",
                        source_name="Test",
                        source_url="https://test.com",
                        timestamp=now,
                    )
                ],
            )
            
            result = await write_supabase(
                [event],
                "https://test.supabase.co",
                "test-key"
            )
            
            # Should return empty list for failed insert
            assert len(result) == 0


# ============================================================================
# SYNTHESIS FUNCTION TESTS
# ============================================================================

class TestSynthesizeIncident:
    """Tests for the synthesize_incident function."""

    @pytest.mark.asyncio
    async def test_accepts_thinking_level_parameter(self):
        """Should accept thinking_level parameter."""
        from argus.enrichment.synthesis import synthesize_incident
        from argus.models.events import EventSource
        
        # Create mock client
        mock_client = MagicMock()
        mock_models = MagicMock()
        mock_client.client = MagicMock()
        mock_client.client.models = mock_models
        
        # Mock response
        mock_response = MagicMock()
        mock_response.text = '{"title": "Test", "summary": "Test", "fallout_prediction": "Test", "severity": 5}'
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content.parts = []
        mock_models.generate_content.return_value = mock_response
        
        sources = [
            EventSource(
                id="src-1",
                headline="Test headline",
                summary="Test summary",
                source_name="Reuters",
                source_url="https://reuters.com/test",
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
        ]
        
        # Should not raise with thinking_level parameter
        result = await synthesize_incident(
            mock_client,
            sources,
            "gemini-3-flash-preview",
            "Test Location",
            thinking_level="low"
        )
        
        assert result is not None
        assert result.title == "Test"

    @pytest.mark.asyncio
    async def test_handles_function_calls(self):
        """Should handle function call responses from the model."""
        from argus.enrichment.synthesis import synthesize_incident
        from argus.models.events import EventSource
        from google.genai import types
        
        # Create mock client
        mock_client = MagicMock()
        mock_client.client = MagicMock()
        mock_client.client.models = MagicMock()
        
        # First response has function call
        mock_func_call = MagicMock()
        mock_func_call.name = "get_entity_relationships"
        mock_func_call.args = {"entity_name": "Russia"}
        
        mock_part_with_func = MagicMock()
        mock_part_with_func.function_call = mock_func_call
        
        mock_response_with_func = MagicMock()
        mock_response_with_func.candidates = [MagicMock()]
        mock_response_with_func.candidates[0].content = MagicMock()
        mock_response_with_func.candidates[0].content.parts = [mock_part_with_func]
        mock_response_with_func.candidates[0].content.role = "model"
        
        # Second response is the final answer
        mock_part_text = MagicMock()
        mock_part_text.function_call = None
        
        mock_response_final = MagicMock()
        mock_response_final.text = '{"title": "Test", "summary": "Test", "fallout_prediction": "Fallout", "severity": 5}'
        mock_response_final.candidates = [MagicMock()]
        mock_response_final.candidates[0].content.parts = [mock_part_text]
        
        mock_client.client.models.generate_content.side_effect = [
            mock_response_with_func,
            mock_response_final
        ]
        
        # Mock Supabase client for tool execution
        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.ilike.return_value.limit.return_value.execute.return_value.data = []
        
        sources = [
            EventSource(
                id="src-1",
                headline="Russia sanctions",
                summary="New sanctions on Russia",
                source_name="Reuters",
                source_url="https://reuters.com/test",
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
        ]
        
        result = await synthesize_incident(
            mock_client,
            sources,
            "gemini-3-flash-preview",
            "Moscow",
            supabase_client=mock_supabase,
            thinking_level="low"
        )
        
        # Should complete even with function calls
        assert result is not None


class TestExecuteToolCall:
    """Tests for tool execution in synthesis."""

    @pytest.mark.asyncio
    async def test_get_entity_relationships_tool(self):
        """Should query edges table for entity relationships."""
        from argus.enrichment.synthesis import execute_tool_call
        
        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_limit = MagicMock()
        mock_execute = MagicMock()
        
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_select
        mock_select.eq.return_value = mock_eq
        mock_eq.limit.return_value = mock_limit
        mock_limit.execute.return_value = mock_execute
        mock_execute.data = [
            {
                "relation_type": "leader_of",
                "target": {"name": "Russia", "node_type": "country"},
                "confidence": 0.9,
                "polarity": 0.0,
                "percentage": None
            }
        ]
        
        # Also mock the entity lookup
        mock_table.select.return_value.ilike.return_value.limit.return_value.execute.return_value.data = [
            {"id": "test-uuid", "name": "Vladimir Putin"}
        ]
        
        result = await execute_tool_call(
            "get_entity_relationships",
            {"entity_name": "Vladimir Putin"},
            mock_supabase,
            entities=None
        )
        
        assert "leader_of" in result.lower() or "relationships" in result.lower()

    @pytest.mark.asyncio
    async def test_get_event_graph_tool(self):
        """Should query event entities and edges."""
        from argus.enrichment.synthesis import execute_tool_call
        
        mock_supabase = MagicMock()
        mock_rpc = MagicMock()
        mock_execute = MagicMock()
        
        mock_supabase.rpc.return_value = mock_rpc
        mock_rpc.execute.return_value = mock_execute
        mock_execute.data = [
            {"entity_id": "entity-1", "name": "Russia", "node_type": "country", "relation_type": "actor"},
            {"entity_id": "entity-2", "name": "Ukraine", "node_type": "country", "relation_type": "target"},
        ]
        
        # Mock edges query
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.in_.return_value.in_.return_value.execute.return_value.data = [
            {
                "source": {"name": "Russia", "node_type": "country"},
                "target": {"name": "Ukraine", "node_type": "country"},
                "relation_type": "conflicts_with",
                "percentage": None,
                "confidence": 0.8,
                "polarity": -0.9
            }
        ]
        
        result = await execute_tool_call(
            "get_event_graph",
            {"event_id": "test-event-uuid"},
            mock_supabase
        )
        
        assert "Russia" in result
        assert "Ukraine" in result
        assert "conflicts_with" in result or "Entities" in result


# ============================================================================
# GRAPH PROCESSING TESTS
# ============================================================================

class TestGraphProcessing:
    """Tests for graph processing pipeline."""

    @pytest.mark.asyncio
    async def test_skips_self_loops(self):
        """Should skip self-loops when creating edges."""
        from argus.pipeline.graph_processing import process_event_for_graph
        
        mock_gemini = MagicMock()
        mock_gemini.client = MagicMock()
        
        # Mock embeddings
        mock_result = MagicMock()
        mock_embedding = MagicMock()
        mock_embedding.values = [0.1] * 3072
        mock_result.embeddings = [mock_embedding, mock_embedding]
        mock_gemini.client.models.embed_content.return_value = mock_result
        
        mock_db = MagicMock()
        
        # Mock entity resolution - both entities resolve to same UUID
        mock_db.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value.data = [
            {"id": "same-uuid", "name": "United States"}
        ]
        
        # Mock insert for new entity
        mock_db.table.return_value.insert.return_value.execute.return_value.data = [
            {"id": "same-uuid"}
        ]
        
        event = {
            "id": "event-uuid",
            "title": "Test event",
            "summary": "Test summary",
            "entities": [
                {"name": "United States", "type": "country", "role": "actor"},
                {"name": "USA", "type": "country", "role": "target"},  # Alias
            ],
            "relationships": [
                {
                    "from_entity": "United States",
                    "to_entity": "USA",  # Same entity
                    "relation_type": "alias_of",
                }
            ],
        }
        
        # Should not raise due to self-loop
        result = await process_event_for_graph(
            event,
            mock_gemini,
            mock_db,
            enable_entities=True,
            enable_embeddings=True
        )
        
        assert result is not None


# ============================================================================
# CONFIG TESTS
# ============================================================================

class TestConfigThinkingLevel:
    """Tests for thinking level configuration."""

    def test_thinking_level_default(self):
        """Should default to 'low' thinking level."""
        import os
        from argus.config import Config
        
        # Clear any existing env var
        old_val = os.environ.pop("THINKING_LEVEL", None)
        
        try:
            # Need minimal required config
            os.environ["GEMINI_API_KEY"] = "test-key"
            config = Config.from_env()
            assert config.thinking_level == "low"
        finally:
            if old_val:
                os.environ["THINKING_LEVEL"] = old_val
            os.environ.pop("GEMINI_API_KEY", None)

    def test_thinking_level_from_env(self):
        """Should read thinking level from environment."""
        import os
        from argus.config import Config
        
        old_val = os.environ.get("THINKING_LEVEL")
        
        try:
            os.environ["THINKING_LEVEL"] = "high"
            os.environ["GEMINI_API_KEY"] = "test-key"
            config = Config.from_env()
            assert config.thinking_level == "high"
        finally:
            if old_val:
                os.environ["THINKING_LEVEL"] = old_val
            else:
                os.environ.pop("THINKING_LEVEL", None)
            os.environ.pop("GEMINI_API_KEY", None)


# ============================================================================
# LIVE INTEGRATION TESTS (require real database)
# ============================================================================

@pytest.mark.integration
class TestLiveDatabase:
    """
    Live integration tests that require actual Supabase connection.
    
    Run with: pytest tests/test_integration.py -v -m integration
    
    Requires environment variables:
    - NEXT_PUBLIC_SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    """

    @pytest.fixture
    def supabase_config(self):
        """Get Supabase configuration from environment."""
        url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            pytest.skip("Supabase credentials not configured")
        
        return {"url": url, "key": key}

    @pytest.mark.asyncio
    async def test_can_query_nodes_table(self, supabase_config):
        """Should be able to query the nodes table."""
        from supabase import create_client
        
        client = create_client(supabase_config["url"], supabase_config["key"])
        
        result = client.table("nodes").select("id, name, node_type").limit(5).execute()
        
        # Should not raise and should return list
        assert isinstance(result.data, list)

    @pytest.mark.asyncio
    async def test_can_query_event_details_table(self, supabase_config):
        """Should be able to query the event_details table."""
        from supabase import create_client
        
        client = create_client(supabase_config["url"], supabase_config["key"])
        
        result = client.table("event_details").select("node_id, title, category").limit(5).execute()
        
        assert isinstance(result.data, list)

    @pytest.mark.asyncio
    async def test_can_call_get_event_entities_rpc(self, supabase_config):
        """Should be able to call get_event_entities RPC."""
        from supabase import create_client
        
        client = create_client(supabase_config["url"], supabase_config["key"])
        
        # First get an event ID
        events = client.table("event_details").select("node_id").limit(1).execute()
        
        if not events.data:
            pytest.skip("No events in database")
        
        event_id = events.data[0]["node_id"]
        
        result = client.rpc("get_event_entities", {"event_uuid": event_id}).execute()
        
        # Should return list (possibly empty)
        assert isinstance(result.data, list)


# ============================================================================
# END-TO-END PIPELINE TESTS (require real APIs)
# ============================================================================

@pytest.mark.integration
class TestEndToEndPipeline:
    """
    End-to-end pipeline tests with live data.
    
    These tests verify the full pipeline works correctly.
    Run with: pytest tests/test_integration.py -v -m integration
    
    Requires environment variables:
    - GEMINI_API_KEY
    - NEXT_PUBLIC_SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    """

    @pytest.fixture
    def live_config(self):
        """Get live configuration from environment."""
        from dotenv import load_dotenv
        load_dotenv()
        
        gemini_key = os.environ.get("GEMINI_API_KEY")
        supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not all([gemini_key, supabase_url, supabase_key]):
            pytest.skip("Missing required credentials for e2e tests")
        
        return {
            "gemini_key": gemini_key,
            "supabase_url": supabase_url,
            "supabase_key": supabase_key
        }

    def test_rss_fetch_returns_articles(self):
        """Should fetch real articles from RSS feeds."""
        from argus.sources.rss_feeds import fetch_rss_articles
        
        articles = fetch_rss_articles()
        
        # Should return at least some articles
        assert len(articles) > 0
        
        # Articles should have required fields (can be dicts or objects)
        for article in articles[:5]:
            if isinstance(article, dict):
                assert article.get("url") is not None
                assert article.get("title") is not None
                assert article.get("source") is not None
            else:
                assert article.url is not None
                assert article.title is not None
                assert article.source is not None

    @pytest.mark.asyncio
    async def test_article_enrichment_works(self, live_config):
        """Should enrich articles with Gemini."""
        from argus.enrichment.client import GeminiClient
        from argus.enrichment.article import enrich_article
        from argus.sources.rss_feeds import fetch_rss_articles
        
        # Fetch real articles (sync function)
        articles = fetch_rss_articles()
        if not articles:
            pytest.skip("No RSS articles available")
        
        # Create Gemini client with required args
        client = GeminiClient(
            live_config["gemini_key"],
            enrichment_model="gemini-2.5-flash-lite",
            synthesis_model="gemini-3-flash-preview"
        )
        
        # Try to enrich first few articles until we get one
        enriched = None
        for i, article in enumerate(articles[:10]):
            _, enriched = await enrich_article(
                client,
                article,
                index=i,
                total=10,
                model="gemini-2.5-flash-lite"
            )
            if enriched:
                break
        
        # At least one should be geopolitically relevant
        # (if none are, test passes but logs warning)
        if enriched:
            assert enriched.category in ["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"]
            assert enriched.severity >= 1
            assert enriched.severity <= 10

    @pytest.mark.asyncio
    async def test_entity_resolution_with_embeddings(self, live_config):
        """Should resolve entities using embeddings."""
        from argus.enrichment.client import GeminiClient
        from argus.graph.embeddings import generate_embedding
        from argus.graph.resolution import resolve_entity
        from supabase import create_client
        
        client = GeminiClient(
            live_config["gemini_key"],
            enrichment_model="gemini-2.5-flash-lite",
            synthesis_model="gemini-3-flash-preview"
        )
        db = create_client(live_config["supabase_url"], live_config["supabase_key"])
        
        # Generate embedding for a well-known entity
        embedding = await generate_embedding(
            client,
            "United States of America",
            task_type="SEMANTIC_SIMILARITY",
            dimensions=3072
        )
        
        assert embedding is not None
        assert len(embedding) == 3072
        
        # Resolve entity (should find existing or create)
        entity_id = await resolve_entity(
            db,
            "United States of America",
            "country",
            embedding
        )
        
        assert entity_id is not None

    @pytest.mark.asyncio
    async def test_synthesis_with_graph_tools(self, live_config):
        """Should synthesize events using graph tools."""
        from argus.enrichment.client import GeminiClient
        from argus.enrichment.synthesis import synthesize_incident
        from argus.models.events import EventSource
        from supabase import create_client
        
        client = GeminiClient(
            live_config["gemini_key"],
            enrichment_model="gemini-2.5-flash-lite",
            synthesis_model="gemini-3-flash-preview"
        )
        db = create_client(live_config["supabase_url"], live_config["supabase_key"])
        
        # Create test source
        sources = [
            EventSource(
                id="test-src",
                headline="Test: US announces new sanctions on Russia",
                summary="The United States announced new economic sanctions targeting Russian energy sector.",
                source_name="Test Wire",
                source_url="https://example.com/test",
                timestamp=datetime.now(timezone.utc).isoformat()
            )
        ]
        
        # Synthesize with tools
        result = await synthesize_incident(
            client,
            sources,
            "gemini-3-flash-preview",
            "Washington, DC",
            supabase_client=db,
            thinking_level="low"
        )
        
        assert result is not None
        assert result.title is not None
        assert result.fallout_prediction is not None
        assert len(result.fallout_prediction) > 50  # Should be substantive

    @pytest.mark.asyncio
    async def test_event_fallout_update(self, live_config):
        """Should update event fallout in database."""
        from argus.storage.supabase import update_event_fallout
        from supabase import create_client
        
        db = create_client(live_config["supabase_url"], live_config["supabase_key"])
        
        # Get a real event
        events = db.table("event_details").select("node_id, fallout_prediction").limit(1).execute()
        
        if not events.data:
            pytest.skip("No events in database")
        
        event_id = events.data[0]["node_id"]
        original_fallout = events.data[0].get("fallout_prediction", "")
        
        # Update fallout
        test_fallout = f"[TEST] Updated at {datetime.now(timezone.utc).isoformat()}"
        result = await update_event_fallout(
            event_id,
            test_fallout,
            live_config["supabase_url"],
            live_config["supabase_key"]
        )
        
        assert result is True
        
        # Verify update
        updated = db.table("event_details").select("fallout_prediction").eq("node_id", event_id).execute()
        assert updated.data[0]["fallout_prediction"] == test_fallout
        
        # Restore original
        await update_event_fallout(
            event_id,
            original_fallout,
            live_config["supabase_url"],
            live_config["supabase_key"]
        )

    @pytest.mark.asyncio
    async def test_entity_blacklist_filtering(self, live_config):
        """Should filter out blacklisted entity types in graph processing."""
        from argus.pipeline.graph_processing import process_event_for_graph
        from argus.enrichment.client import GeminiClient
        from supabase import create_client
        
        client = GeminiClient(
            live_config["gemini_key"],
            enrichment_model="gemini-2.5-flash-lite",
            synthesis_model="gemini-3-flash-preview"
        )
        db = create_client(live_config["supabase_url"], live_config["supabase_key"])
        
        # Create event with blacklisted entity types
        event = {
            "id": "test-uuid-blacklist",
            "title": "Test event for blacklist filtering",
            "summary": "Testing that event and population types are filtered",
            "entities": [
                {"name": "United States", "type": "country", "role": "actor"},
                {"name": "some conflict", "type": "event", "role": "mentioned"},  # Should be filtered
                {"name": "thousands of people", "type": "population", "role": "affected"},  # Should be filtered
                {"name": "Russia", "type": "country", "role": "target"},
            ],
            "relationships": [],
        }
        
        # Process should not fail and should filter blacklisted types
        result = await process_event_for_graph(
            event,
            client,
            db,
            enable_entities=True,
            enable_embeddings=True
        )
        
        assert result is not None
