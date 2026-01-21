"""
Pytest fixtures for Realpolitik worker tests.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
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
