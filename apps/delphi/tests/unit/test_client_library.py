"""Unit tests for client library"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
import sys
from pathlib import Path

# Ensure realpolitik_clients can be imported
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "libs" / "realpolitik-clients" / "src"))

# Test Atlas (PostgreSQL) client
@pytest.mark.asyncio
async def test_atlas_client_initialization():
    """Test Atlas client initialization"""
    from realpolitik_clients import AtlasClient
    
    client = AtlasClient("postgresql://test:test@localhost:5432/test")
    
    assert client.database_url == "postgresql://test:test@localhost:5432/test"
    assert client.engine is None
    assert client.session_maker is None


@pytest.mark.asyncio
async def test_atlas_client_connection():
    """Test Atlas client connection"""
    from realpolitik_clients import AtlasClient
    
    client = AtlasClient("postgresql://test:test@localhost:5432/test")
    
    # Mock the async engine creation
    with patch('sqlalchemy.ext.asyncio.create_async_engine') as mock_create_engine:
        with patch('asyncpg.connect') as mock_connect:
            mock_engine = AsyncMock()
            mock_create_engine.return_value = mock_engine
            mock_connect.return_value = AsyncMock()
            
            await client.connect()
            
            assert client.engine is not None
            assert client.session_maker is not None
            
            # Verify engine was created
            mock_create_engine.assert_called_once()


@pytest.mark.asyncio
async def test_atlas_get_events():
    """Test Atlas get_events method"""
    from realpolitik_clients import AtlasClient
    
    client = AtlasClient("postgresql://test:test@localhost:5432/test")
    
    # Mock the session and database operations
    mock_session = AsyncMock()
    mock_result = AsyncMock()
    mock_row = Mock()
    mock_row._mapping = {
        "id": "evt-001",
        "title": "Test Event",
        "category": "MILITARY"
    }
    mock_result.fetchall.return_value = [mock_row]
    mock_session.execute.return_value = mock_result
    
    with patch.object(client, 'session_maker') as mock_session_maker:
        mock_session_maker.return_value.__aenter__.return_value = mock_session
        
        events = await client.get_events(limit=10, category="MILITARY")
        
        assert len(events) == 1
        assert events[0]["id"] == "evt-001"
        assert events[0]["category"] == "MILITARY"
        
        # Verify the query was called with correct parameters
        mock_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_atlas_write_event():
    """Test Atlas write_event method with outbox pattern"""
    from realpolitik_clients import AtlasClient
    
    client = AtlasClient("postgresql://test:test@localhost:5432/test")
    
    event_data = {
        "title": "Test Event",
        "category": "MILITARY",
        "summary": "Test summary"
    }
    
    mock_session = AsyncMock()
    mock_result = AsyncMock()
    mock_result.scalar.return_value = "evt-123"
    mock_session.begin.return_value.__aenter__.return_value = mock_session
    mock_session.execute.return_value = mock_result
    
    with patch.object(client, 'session_maker') as mock_session_maker:
        mock_session_maker.return_value.__aenter__.return_value = mock_session
        
        event_id = await client.write_event(event_data)
        
        assert event_id == "evt-123"
        
        # Verify both event and outbox inserts were called
        assert mock_session.execute.call_count == 2


@pytest.mark.asyncio
async def test_atlas_test_connection():
    """Test Atlas connection testing"""
    from realpolitik_clients import AtlasClient
    
    client = AtlasClient("postgresql://test:test@localhost:5432/test")
    client.engine = AsyncMock()
    
    # Test successful connection
    result = await client.test_connection()
    assert result is True
    
    # Test failed connection
    client.engine.begin.side_effect = Exception("Connection failed")
    result = await client.test_connection()
    assert result is False


# Test Ariadne (Neo4j) client
@pytest.mark.asyncio
async def test_ariadne_client_initialization():
    """Test Ariadne client initialization"""
    from realpolitik_clients import AriadneClient
    
    client = AriadneClient("bolt://localhost:7687", "neo4j", "password")
    
    assert client.uri == "bolt://localhost:7687"
    assert client.username == "neo4j"
    assert client.password == "password"
    assert client.driver is None


@pytest.mark.asyncio
async def test_ariadne_client_connection():
    """Test Ariadne client connection"""
    from realpolitik_clients import AriadneClient
    from neo4j import AsyncGraphDatabase
    
    client = AriadneClient("bolt://localhost:7687", "neo4j", "password")
    
    # Mock Neo4j driver
    with patch.object(AsyncGraphDatabase, 'driver') as mock_driver:
        mock_driver_instance = AsyncMock()
        mock_driver.return_value = mock_driver_instance
        
        await client.connect()
        
        assert client.driver is not None
        mock_driver.assert_called_once_with(
            "bolt://localhost:7687",
            auth=("neo4j", "password")
        )


@pytest.mark.asyncio
async def test_ariadne_create_event_node():
    """Test creating event nodes in Neo4j"""
    from realpolitik_clients import AriadneClient
    
    client = AriadneClient("bolt://localhost:7687", "neo4j", "password")
    client.driver = AsyncMock()
    
    mock_session = AsyncMock()
    mock_result = AsyncMock()
    mock_record = Mock()
    mock_record.__getitem__ = Mock(return_value={"id": "evt-123"})
    mock_result.single.return_value = mock_record
    mock_session.run.return_value = mock_result
    client.driver.session.return_value.__aenter__.return_value = mock_session
    
    event_data = {
        "id": "evt-123",
        "title": "Test Event",
        "category": "MILITARY"
    }
    
    await client.create_event_node(event_data)
    
    # Verify session was used to create the node
    mock_session.run.assert_called_once()


# Test Lethe (Redis) client
@pytest.mark.asyncio
async def test_lethe_client_initialization():
    """Test Lethe client initialization"""
    from realpolitik_clients import LetheClient
    
    client = LetheClient("redis://localhost:6379")
    
    assert client.url == "redis://localhost:6379"
    assert client.redis_client is None


@pytest.mark.asyncio
async def test_lethe_cache_operations():
    """Test Lethe caching operations"""
    from realpolitik_clients import LetheClient
    
    client = LetheClient("redis://localhost:6379")
    client.redis_client = AsyncMock()
    
    # Test cache_analysis
    analysis_data = {"result": "test analysis"}
    await client.cache_analysis("test-key", analysis_data, ttl=3600)
    
    # Verify setex was called
    client.redis_client.setex.assert_called_once_with("test-key", 3600, '{"result": "test analysis"}')
    
    # Test get_cached_analysis
    client.redis_client.get.return_value = '{"result": "cached analysis"}'
    cached = await client.get_cached_analysis("test-key")
    
    assert cached["result"] == "cached analysis"
    client.redis_client.get.assert_called_once_with("test-key")


@pytest.mark.asyncio
async def test_lethe_rate_limiting():
    """Test Lethe rate limiting functionality"""
    from realpolitik_clients import LetheClient
    
    client = LetheClient("redis://localhost:6379")
    client.redis_client = AsyncMock()
    
    # Mock Redis time and operations
    client.redis_client.time.return_value = (1640995200, 0)  # Unix timestamp
    client.redis_client.zremrangebyscore.return_value = 0
    client.redis_client.zcard.return_value = 5  # 5 requests in window
    
    # Test allowed request (under limit)
    client.redis_client.zcard.return_value = 5
    allowed, remaining = await client.check_rate_limit("user123", "/api/test", 10, 3600)
    
    assert allowed is True
    assert remaining == 4
    
    # Test rate limit exceeded
    client.redis_client.zcard.return_value = 10
    allowed, remaining = await client.check_rate_limit("user123", "/api/test", 10, 3600)
    
    assert allowed is False
    assert remaining == 0


# Test Iris (RabbitMQ) client
@pytest.mark.asyncio
async def test_iris_client_initialization():
    """Test Iris client initialization"""
    from realpolitik_clients import IrisClient
    
    client = IrisClient("amqp://localhost:5672")
    
    assert client.url == "amqp://localhost:5672"
    assert client.exchange_name == "realpolitik.events"


@pytest.mark.asyncio
async def test_iris_publish_operations():
    """Test Iris publishing operations"""
    from realpolitik_clients import IrisClient
    import pika
    
    client = IrisClient("amqp://localhost:5672")
    
    # Mock pika connection and channel
    mock_connection = AsyncMock()
    mock_channel = AsyncMock()
    client.connection = mock_connection
    client.channel = mock_channel
    
    event_data = {
        "id": "evt-123",
        "title": "Test Event",
        "category": "MILITARY"
    }
    
    await client.publish_event(event_data)
    
    # Verify publish was called
    mock_channel.basic_publish.assert_called_once()


# Test Mnemosyne (Qdrant) client
@pytest.mark.asyncio
async def test_mnemosyne_client_initialization():
    """Test Mnemosyne client initialization"""
    from realpolitik_clients import MnemosyneClient
    
    client = MnemosyneClient("localhost", 6333)
    
    assert client.host == "localhost"
    assert client.port == 6333
    assert client.client is None


@pytest.mark.asyncio
async def test_mnemosyne_collection_operations():
    """Test Mnemosyne collection and search operations"""
    from realpolitik_clients import MnemosyneClient
    from qdrant_client.http.models import Distance, VectorParams, PointStruct
    
    client = MnemosyneClient("localhost", 6333)
    client.client = AsyncMock()
    
    # Mock collections response
    mock_collections = Mock()
    mock_collections.collections = []  # Empty, so collection doesn't exist
    client.client.get_collections.return_value = mock_collections
    
    embedding = [0.1, 0.2, 0.3]
    event_data = {"title": "Test Event", "category": "MILITARY"}
    
    await client.insert_event_embedding("events", "evt-123", embedding, event_data)
    
    # Verify collection was created and point was inserted
    client.client.create_collection.assert_called_once()
    client.client.upsert.assert_called_once()