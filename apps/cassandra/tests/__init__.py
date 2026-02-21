"""
Test configuration for Cassandra microservice.

This module provides common test fixtures and configuration
for the Cassandra testing suite.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock
from datetime import datetime, timezone
from uuid import uuid4

# Mark all tests as async by default
pytestmark = pytest.mark.asyncio


@pytest.fixture
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def sample_analysis_request():
    """Create a sample analysis request for testing."""
    from src.models.requests import AnalysisRequest
    
    return AnalysisRequest(
        request_id=uuid4(),
        event_ids=["event-1", "event-2", "event-3"],
        priority="normal",
        user_id="test-user-123",
        webhook_url=None,
        metadata={"source": "test"}
    )


@pytest.fixture
def sample_analysis_response():
    """Create a sample analysis response for testing."""
    from src.models.requests import AnalysisResponse
    
    return AnalysisResponse(
        analysis_id=uuid4(),
        request_id=uuid4(),
        status="COMPLETED",
        progress=100.0,
        results={
            "cascading_effects": "Test analysis results",
            "confidence_score": 0.85,
            "cost_actual": 2.45
        },
        completed_at=datetime.now(timezone.utc)
    )


@pytest.fixture
def mock_database_queries():
    """Mock database queries."""
    mock = Mock()
    mock.get_events = AsyncMock(return_value=[])
    mock.get_entities = AsyncMock(return_value=[])
    mock.store_analysis = AsyncMock(return_value=True)
    return mock


@pytest.fixture
def mock_ai_client():
    """Mock AI client for testing."""
    mock = Mock()
    mock.enrich_event = AsyncMock(return_value={"enriched": True})
    mock.synthesize_analysis = AsyncMock(return_value={
        "cascading_effects": "Mock analysis",
        "confidence_score": 0.8
    })
    mock.check_quota = AsyncMock()
    mock.get_model_info = Mock(return_value={
        "provider": "mock",
        "enrichment_model": "mock-haiku",
        "synthesis_model": "mock-sonnet"
    })
    return mock


@pytest.fixture
def mock_cache():
    """Mock cache client."""
    mock = Mock()
    mock.get_cached_analysis = AsyncMock(return_value=None)
    mock.cache_analysis = AsyncMock(return_value=True)
    mock.invalidate_analysis = AsyncMock(return_value=True)
    return mock