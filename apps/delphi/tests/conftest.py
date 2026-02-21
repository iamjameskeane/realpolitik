"""Test configuration and shared fixtures"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from typing import Dict, Any

# Test client fixture
@pytest.fixture
def test_client():
    """Create a test client for FastAPI application"""
    from src.delphi.main_simple import app
    return TestClient(app)

# Mock user fixtures
@pytest.fixture
def mock_user():
    """Mock authenticated user"""
    return {
        "sub": "test-user-123",
        "email": "test@example.com",
        "role": "analyst",
        "permissions": ["read:events", "read:entities", "request:analysis"],
        "tier": "premium"
    }

@pytest.fixture
def mock_admin_user():
    """Mock admin user"""
    return {
        "sub": "admin-user-456",
        "email": "admin@example.com",
        "role": "admin",
        "permissions": ["read:events", "read:entities", "request:analysis", "admin:access"],
        "tier": "enterprise"
    }

# Mock database fixtures
@pytest.fixture
def mock_events():
    """Mock events data"""
    return [
        {
            "id": "evt-001",
            "title": "Diplomatic Summit in Geneva",
            "summary": "International leaders meet to discuss trade agreements",
            "category": "DIPLOMATIC",
            "severity": "MEDIUM",
            "occurred_at": "2024-02-21T10:00:00Z",
            "primary_location": "Geneva, Switzerland"
        },
        {
            "id": "evt-002",
            "title": "Military Exercise Begins",
            "summary": "Joint military exercise between NATO allies",
            "category": "MILITARY",
            "severity": "HIGH",
            "occurred_at": "2024-02-21T08:00:00Z",
            "primary_location": "Baltic States"
        }
    ]

# Mock clients fixtures
@pytest.fixture
def mock_atlas_client():
    """Mock Atlas (PostgreSQL) client"""
    client = Mock()
    client.get_events = AsyncMock(return_value=[])
    client.write_event = AsyncMock(return_value="evt-123")
    client.store_analysis = AsyncMock()
    client.test_connection = AsyncMock(return_value=True)
    return client

@pytest.fixture
def mock_lethe_client():
    """Mock Lethe (Redis) client"""
    client = Mock()
    client.get_cached_analysis = AsyncMock(return_value=None)
    client.cache_analysis = AsyncMock()
    client.check_rate_limit = AsyncMock(return_value=(True, 99))
    client.test_connection = AsyncMock(return_value=True)
    return client

@pytest.fixture
def mock_iris_client():
    """Mock Iris (RabbitMQ) client"""
    client = Mock()
    client.publish_analysis_request = AsyncMock()
    client.publish_event = AsyncMock()
    client.test_connection = AsyncMock(return_value=True)
    return client

# Environment fixtures
@pytest.fixture
def test_env_vars():
    """Test environment variables"""
    return {
        "ENVIRONMENT": "test",
        "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
        "NEO4J_URI": "bolt://localhost:7687",
        "QDRANT_URI": "http://localhost:6333",
        "REDIS_URL": "redis://localhost:6379",
        "RABBITMQ_URL": "amqp://localhost:5672",
        "JWT_SECRET_KEY": "test-secret",
        "OPENROUTER_API_KEY": "test-openrouter-key",
        "RATE_LIMIT_ENABLED": "false"
    }

# Async test setup
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()