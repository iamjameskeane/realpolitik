"""
Pytest fixtures for Realpolitik worker tests.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, Mock
from datetime import datetime, timezone


@pytest.fixture
def sample_article():
    """Sample article for testing enrichment."""
    return {
        "title": "Test Article: Major Diplomatic Event",
        "summary": "A significant diplomatic meeting occurred between world leaders.",
        "source_name": "Test News",
        "source_url": "https://example.com/article",
        "published": datetime.now(timezone.utc).isoformat(),
    }


@pytest.fixture
def sample_event():
    """Sample event for testing notifications."""
    return {
        "id": "test-event-123",
        "title": "Test Event: Diplomatic Summit",
        "summary": "World leaders met to discuss global issues.",
        "severity": 7,
        "category": "DIPLOMACY",
        "location_name": "Geneva, Switzerland",
        "coordinates": [6.14, 46.20],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "region": "EUROPE",
        "sources": [
            {
                "id": "source-1",
                "headline": "Leaders Meet in Geneva",
                "summary": "A diplomatic summit was held.",
                "source_name": "Reuters",
                "source_url": "https://reuters.com/article",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }


@pytest.fixture
def sample_events_list(sample_event):
    """List of sample events for batch testing."""
    return [
        sample_event,
        {
            **sample_event,
            "id": "test-event-456",
            "title": "Another Event",
            "severity": 5,
            "category": "ECONOMY",
        },
        {
            **sample_event,
            "id": "test-event-789",
            "title": "Third Event",
            "severity": 9,
            "category": "MILITARY",
        },
    ]


@pytest.fixture
def mock_gemini_client():
    """Mock Gemini client for testing without API calls."""
    client = MagicMock()
    client.models = MagicMock()
    client.models.generate_content = AsyncMock()
    return client


@pytest.fixture
def mock_requests(mocker):
    """Mock requests library for testing HTTP calls."""
    return mocker.patch("requests.post")


@pytest.fixture
def mock_redis(mocker):
    """Mock Redis client for testing without Redis connection."""
    mock = MagicMock()
    mock.sadd = AsyncMock(return_value=1)
    mock.smembers = AsyncMock(return_value=set())
    mock.expire = AsyncMock(return_value=True)
    return mock


# ============================================================================
# CONSTELLATION GRAPH FIXTURES
# ============================================================================

@pytest.fixture
def sample_entities():
    """Sample entities for graph testing."""
    return [
        {"name": "TSMC", "type": "company", "role": "actor"},
        {"name": "Taiwan", "type": "country", "role": "location"},
        {"name": "Apple", "type": "company", "role": "affected"},
    ]


@pytest.fixture
def sample_relationships():
    """Sample relationships for graph testing."""
    return [
        {
            "from_entity": "Taiwan",
            "to_entity": "TSMC",
            "relation_type": "hosts",
            "percentage": None,
            "polarity": 0.5,
            "detail": "TSMC headquarters in Taiwan"
        },
        {
            "from_entity": "TSMC",
            "to_entity": "Apple",
            "relation_type": "supplies",
            "percentage": 90,
            "polarity": 0.7,
            "detail": "TSMC supplies 90% of Apple's advanced chips"
        },
    ]


@pytest.fixture
def sample_embedding():
    """Sample 3072-dimensional embedding vector."""
    import numpy as np
    # Create a normalized random vector
    vec = np.random.randn(3072)
    return (vec / np.linalg.norm(vec)).tolist()


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client for graph operations."""
    mock_db = MagicMock()

    # Create a proper async mock with data attribute
    def create_async_mock_with_data(data=None):
        mock_execute = AsyncMock()
        mock_execute.data = data if data is not None else []
        return mock_execute

    # Mock table() chain
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_eq = MagicMock()

    # Chain them together - each step should return a mock that supports async operations
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_eq.eq.return_value = mock_eq
    mock_eq.execute = create_async_mock_with_data([])

    # Mock table operations
    mock_table.insert = create_async_mock_with_data([{"id": "node-new"}])
    mock_table.update = MagicMock()
    mock_table.upsert = create_async_mock_with_data([])

    mock_db.table.return_value = mock_table

    # Mock RPC calls
    mock_rpc = create_async_mock_with_data([])
    mock_db.rpc.return_value = mock_rpc

    return mock_db


@pytest.fixture
def mock_db_connection():
    """Mock async database connection for graph operations."""
    mock_conn = MagicMock()

    # Mock fetchrow for queries - return None by default (no rows found)
    mock_fetchrow = AsyncMock(return_value=None)
    mock_conn.fetchrow = mock_fetchrow

    # Mock execute for updates
    mock_execute = AsyncMock()
    mock_conn.execute = mock_execute

    return mock_conn


@pytest.fixture
def mock_db_connection_with_existing_edge():
    """Mock async database connection that finds an existing edge."""
    mock_conn = MagicMock()

    # Mock fetchrow to return an existing edge
    mock_row = Mock()
    mock_row.__getitem__ = Mock(side_effect=lambda key: {
        'id': 'edge-123',
        'hit_count': 5,
        'confidence': 0.7
    }[key])

    mock_fetchrow = AsyncMock(return_value=mock_row)
    mock_conn.fetchrow = mock_fetchrow

    # Mock execute for updates
    mock_execute = AsyncMock()
    mock_conn.execute = mock_execute

    return mock_conn


@pytest.fixture
def mock_db_connection_with_new_edge():
    """Mock async database connection that creates a new edge."""
    mock_conn = MagicMock()

    # Mock fetchrow to return None for first call (no existing edge)
    # and a new edge ID for second call (INSERT RETURNING)
    call_count = 0

    def mock_fetchrow_func(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First call: check if edge exists - return None (no edge)
            return None
        else:
            # Second call: INSERT RETURNING - return new edge ID
            mock_row = Mock()
            mock_row.__getitem__ = Mock(side_effect=lambda key: {
                'id': 'edge-123'
            }[key])
            return mock_row

    mock_conn.fetchrow = AsyncMock(side_effect=mock_fetchrow_func)

    # Mock execute for updates
    mock_execute = AsyncMock()
    mock_conn.execute = mock_execute

    return mock_conn


@pytest.fixture
def mock_gemini_embedding_client():
    """Mock Gemini client specifically for embedding generation."""
    client = MagicMock()
    
    # Mock embed_content response
    mock_result = MagicMock()
    mock_embedding = MagicMock()
    mock_embedding.values = [0.1] * 3072  # 3072-dim vector
    mock_result.embeddings = [mock_embedding]
    
    client.models.embed_content = MagicMock(return_value=mock_result)
    
    return client
