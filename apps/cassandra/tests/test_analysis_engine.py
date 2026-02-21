"""
Tests for Cassandra analysis engine.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from src.config import Config
from src.analysis_engine import CassandraAnalysisEngine
from src.models.requests import AnalysisRequest
from src.models.events import EventSource


@pytest.fixture
def mock_config():
    """Create mock configuration."""
    config = Mock()
    config.database_url = "postgresql://test:test@localhost/test"
    config.neo4j_uri = "bolt://localhost:7687"
    config.neo4j_username = "test"
    config.neo4j_password = "test"
    config.qdrant_uri = "http://localhost:6333"
    config.redis_url = "redis://localhost:6379"
    config.rabbitmq_url = "amqp://test:test@localhost:5672"
    config.openrouter_api_key = "test-key"
    config.model_enrichment = "anthropic/claude-3-haiku"
    config.model_synthesis = "anthropic/claude-3-sonnet"
    config.analysis_cache_ttl_hours = 24
    return config


@pytest.fixture
def analysis_engine(mock_config):
    """Create analysis engine with mocked dependencies."""
    with patch('src.analysis_engine.AIClient'), \
         patch('src.analysis_engine.GraphQueries'), \
         patch('src.analysis_engine.DatabaseQueries'), \
         patch('src.analysis_engine.StorageOperations'), \
         patch('src.analysis_engine.ContextAssembler'), \
         patch('src.analysis_engine.EnhancedSynthesizer'):
        engine = CassandraAnalysisEngine(mock_config)
        return engine


@pytest.mark.asyncio
async def test_analysis_request_processing(analysis_engine):
    """Test basic analysis request processing."""
    # Create test request
    request_id = uuid4()
    request = AnalysisRequest(
        request_id=request_id,
        event_ids=["evt-1", "evt-2"],
        priority="normal"
    )
    
    # Mock the analysis flow
    analysis_engine.context_assembler.build_analysis_context = AsyncMock()
    analysis_engine.synthesizer.synthesize_with_context = AsyncMock()
    analysis_engine.storage.check_analysis_cache = AsyncMock(return_value=None)
    analysis_engine.storage.cache_analysis_result = AsyncMock(return_value=True)
    analysis_engine.storage.update_event_in_database = AsyncMock(return_value=True)
    analysis_engine.storage.store_analysis_metadata = AsyncMock(return_value=True)
    
    # Mock context and synthesized event
    mock_context = Mock()
    mock_context.primary_events = [{"id": "evt-1", "sources": []}, {"id": "evt-2", "sources": []}]
    mock_context.entity_neighborhood = []
    mock_context.historical_analogues = []
    mock_context.causal_chains = []
    mock_context.relationship_graph = {}
    mock_context.graph_query_time_ms = 100
    mock_context.context_size_tokens = 1000
    
    analysis_engine.context_assembler.build_analysis_context.return_value = mock_context
    
    mock_synthesized = Mock()
    mock_synthesized.fallout_prediction = "Enhanced fallout prediction"
    analysis_engine.synthesizer.synthesize_with_context.return_value = mock_synthesized
    
    # Process request
    response = await analysis_engine.process_analysis_request(request)
    
    # Assertions
    assert response is not None
    assert response.request_id == request_id
    assert response.status == "completed"
    assert len(response.fallout_predictions) == 2
    
    # Verify components were called
    analysis_engine.context_assembler.build_analysis_context.assert_called_once_with(
        ["evt-1", "evt-2"], include_historical_analogues=True, include_causal_chains=True
    )


@pytest.mark.asyncio
async def test_cache_hit_processing(analysis_engine):
    """Test processing when analysis is cached."""
    request_id = uuid4()
    request = AnalysisRequest(
        request_id=request_id,
        event_ids=["evt-1"],
        priority="normal"
    )
    
    # Mock cached result
    cached_result = {
        "fallout_predictions": {"evt-1": "Cached fallout prediction"},
        "analysis_metadata": {"cached": True}
    }
    analysis_engine.storage.check_analysis_cache.return_value = cached_result
    
    # Process request
    response = await analysis_engine.process_analysis_request(request)
    
    # Assertions
    assert response is not None
    assert response.status == "completed"
    assert response.fallout_predictions == {"evt-1": "Cached fallout prediction"}
    assert response.analysis_metadata["cached"] is True
    
    # Verify cache was checked and no new analysis was done
    analysis_engine.storage.check_analysis_cache.assert_called_once_with(["evt-1"])


@pytest.mark.asyncio
async def test_error_handling(analysis_engine):
    """Test error handling during analysis."""
    request_id = uuid4()
    request = AnalysisRequest(
        request_id=request_id,
        event_ids=["evt-nonexistent"],
        priority="normal"
    )
    
    # Mock context assembly to raise an error
    analysis_engine.context_assembler.build_analysis_context.side_effect = Exception("Database connection failed")
    
    # Process request
    response = await analysis_engine.process_analysis_request(request)
    
    # Assertions
    assert response is not None
    assert response.status == "failed"
    assert "Database connection failed" in response.error_message


def test_statistics_tracking(analysis_engine):
    """Test statistics tracking."""
    # Initial stats
    stats = analysis_engine.get_statistics()
    assert stats["requests_processed"] == 0
    assert stats["cache_hits"] == 0
    assert stats["cache_misses"] == 0
    
    # Simulate processing
    analysis_engine.stats["requests_processed"] = 5
    analysis_engine.stats["cache_hits"] = 2
    analysis_engine.stats["cache_misses"] = 3
    analysis_engine.stats["total_processing_time"] = 15.0
    
    # Updated stats
    stats = analysis_engine.get_statistics()
    assert stats["requests_processed"] == 5
    assert stats["cache_hit_rate"] == 2/5
    assert stats["average_processing_time"] == 3.0


@pytest.mark.asyncio
async def test_context_assembly(analysis_engine):
    """Test context assembly functionality."""
    # Mock graph queries
    analysis_engine.graph_queries.get_event_entities.return_value = [
        {"id": "entity-1", "name": "Test Entity", "entity_type": "country"}
    ]
    analysis_engine.graph_queries.get_entity_network_context.return_value = {
        "entities": [],
        "relationships": [],
        "hub_entities": []
    }
    analysis_engine.graph_queries.find_historical_analogues.return_value = []
    
    # Mock database queries
    analysis_engine.db_queries.fetch_events_by_ids.return_value = [
        {"id": "evt-1", "title": "Test Event", "sources": []}
    ]
    
    # Test context assembly
    context = await analysis_engine.context_assembler.build_analysis_context(["evt-1"])
    
    assert len(context.primary_events) == 1
    assert context.primary_events[0]["id"] == "evt-1"
    assert len(context.entity_neighborhood) == 1
    assert context.entity_neighborhood[0]["id"] == "entity-1"


@pytest.mark.asyncio
async def test_synthesis_with_tools(analysis_engine):
    """Test enhanced synthesis with tool calling."""
    # Mock AI client
    mock_ai_response = {
        "content": '{"title": "Test Analysis", "summary": "Test summary", "fallout_prediction": "Test fallout", "severity": 7}',
        "tool_calls": [{"name": "get_entity_relationships", "arguments": '{"entity_id": "test"}'}]
    }
    analysis_engine.ai_client.generate_with_tools = AsyncMock(return_value=mock_ai_response)
    
    # Mock tool execution
    analysis_engine.synthesizer.execute_tool_call = AsyncMock(return_value="Entity relationships found")
    
    # Create test event sources
    event_sources = [
        EventSource(
            id="src-1",
            headline="Test Headline",
            summary="Test Summary",
            source_name="Test Source",
            source_url="http://test.com",
            timestamp="2024-01-01T00:00:00Z"
        )
    ]
    
    # Mock context
    mock_context = Mock()
    mock_context.entity_neighborhood = []
    mock_context.relationship_graph = {}
    mock_context.historical_analogues = []
    mock_context.causal_chains = []
    
    # Test synthesis
    result = await analysis_engine.synthesizer.synthesize_with_context(
        event_sources, 
        mock_context, 
        "anthropic/claude-3-sonnet"
    )
    
    assert result is not None
    assert result.title == "Test Analysis"
    assert result.summary == "Test summary"
    assert result.fallout_prediction == "Test fallout"
    assert result.severity == 7
    
    # Verify tool calls were made
    analysis_engine.ai_client.generate_with_tools.assert_called_once()


@pytest.mark.asyncio
async def test_storage_operations(analysis_engine):
    """Test storage operations."""
    # Test cache operations
    analysis_engine.storage.check_analysis_cache = AsyncMock(return_value=None)
    analysis_engine.storage.cache_analysis_result = AsyncMock(return_value=True)
    analysis_engine.storage.update_event_in_database = AsyncMock(return_value=True)
    
    # Test cache miss
    cached = await analysis_engine.storage.check_analysis_cache(["evt-1"])
    assert cached is None
    
    # Test caching
    success = await analysis_engine.storage.cache_analysis_result(
        ["evt-1"], 
        {"evt-1": "Test fallout"}, 
        {"test": "metadata"}
    )
    assert success is True
    
    # Test database update
    success = await analysis_engine.storage.update_event_in_database(
        "evt-1", 
        "Enhanced fallout", 
        {"analysis": "metadata"}
    )
    assert success is True