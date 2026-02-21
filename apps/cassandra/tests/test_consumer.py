"""
Tests for Cassandra message consumer.
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from src.consumer import AnalysisConsumer
from src.models.requests import AnalysisRequest


@pytest.fixture
def mock_config():
    """Create mock configuration."""
    config = Mock()
    config.rabbitmq_url = "amqp://test:test@localhost:5672"
    config.rabbitmq_queue = "analysis.requested"
    config.rabbitmq_routing_key = "analysis.requested"
    config.prefetch_count = 10
    config.retry_attempts = 3
    config.retry_delay_seconds = 30
    return config


@pytest.fixture
def mock_analysis_engine():
    """Create mock analysis engine."""
    engine = Mock()
    engine.process_analysis_request = AsyncMock()
    return engine


@pytest.fixture
def analysis_consumer(mock_config, mock_analysis_engine):
    """Create analysis consumer with mocked dependencies."""
    with patch('src.consumer.IrisClient'):
        consumer = AnalysisConsumer(mock_config, mock_analysis_engine)
        consumer.iris_client = Mock()  # Mock the Iris client
        return consumer


@pytest.mark.asyncio
async def test_message_processing(analysis_consumer, mock_analysis_engine):
    """Test processing of analysis request messages."""
    # Create test request
    request_id = str(uuid4())
    message_data = {
        "request_id": request_id,
        "event_ids": ["evt-1", "evt-2"],
        "priority": "high",
        "user_id": "user-123",
        "metadata": {"source": "web"}
    }
    
    # Mock message object
    mock_message = Mock()
    mock_message.payload.decode.return_value = json.dumps(message_data)
    mock_message.ack = AsyncMock()
    
    # Setup analysis engine response
    mock_response = Mock()
    mock_response.status = "completed"
    mock_response.fallout_predictions = {"evt-1": "fallout1", "evt-2": "fallout2"}
    mock_analysis_engine.process_analysis_request.return_value = mock_response
    
    # Mock publish response
    analysis_consumer._publish_response = AsyncMock()
    
    # Process message
    await analysis_consumer._handle_message(mock_message)
    
    # Verify analysis was processed
    mock_analysis_engine.process_analysis_request.assert_called_once()
    
    # Verify response was published
    analysis_consumer._publish_response.assert_called_once_with(mock_response)
    
    # Verify message was acknowledged
    mock_message.ack.assert_called_once()


@pytest.mark.asyncio
async def test_invalid_message_handling(analysis_consumer):
    """Test handling of invalid message formats."""
    # Invalid message (missing required fields)
    message_data = {"invalid": "data"}
    
    mock_message = Mock()
    mock_message.payload.decode.return_value = json.dumps(message_data)
    mock_message.ack = AsyncMock()
    
    # Process invalid message
    await analysis_consumer._handle_message(mock_message)
    
    # Message should still be acknowledged to prevent infinite retries
    mock_message.ack.assert_called_once()


@pytest.mark.asyncio
async def test_retry_logic(analysis_consumer, mock_analysis_engine):
    """Test retry logic for failed analyses."""
    # Setup analysis engine to fail twice, then succeed
    mock_analysis_engine.process_analysis_request.side_effect = [
        Exception("Temporary failure"),
        Exception("Temporary failure"),
        Mock(status="completed")  # Third attempt succeeds
    ]
    
    request_id = str(uuid4())
    message_data = {
        "request_id": request_id,
        "event_ids": ["evt-1"],
        "priority": "normal"
    }
    
    mock_message = Mock()
    mock_message.payload.decode.return_value = json.dumps(message_data)
    mock_message.ack = AsyncMock()
    
    # Process message (should retry automatically via tenacity)
    await analysis_consumer._handle_message(mock_message)
    
    # Verify retries occurred
    assert mock_analysis_engine.process_analysis_request.call_count >= 2


@pytest.mark.asyncio
async def test_error_response_publishing(analysis_consumer):
    """Test publishing error responses."""
    # Create test request
    request = AnalysisRequest(
        request_id=uuid4(),
        event_ids=["evt-1"],
        priority="normal"
    )
    
    # Mock publish response
    analysis_consumer._publish_response = AsyncMock()
    
    # Publish error response
    await analysis_consumer._publish_error_response(request, "Test error message")
    
    # Verify error response was published
    analysis_consumer._publish_response.assert_called_once()
    
    # Check that the response has the correct status
    published_response = analysis_consumer._publish_response.call_args[0][0]
    assert published_response.status == "failed"
    assert published_response.error_message == "Test error message"


@pytest.mark.asyncio
async def test_webhook_notification(analysis_consumer):
    """Test webhook notification sending."""
    # Create response with webhook URL
    response = Mock()
    response.webhook_url = "https://example.com/webhook"
    response.request_id = uuid4()
    response.status = "completed"
    response.event_ids = ["evt-1"]
    response.completed_at = "2024-01-01T00:00:00Z"
    
    # Mock httpx client
    with patch('src.consumer.httpx.AsyncClient') as mock_client:
        mock_http_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_http_client
        
        # Send webhook
        await analysis_consumer._send_webhook(response)
        
        # Verify webhook was sent
        mock_http_client.post.assert_called_once_with(
            "https://example.com/webhook",
            json={
                "request_id": str(response.request_id),
                "status": "completed",
                "event_ids": ["evt-1"],
                "completed_at": "2024-01-01T00:00:00Z"
            }
        )


def test_consumer_initialization(mock_config, mock_analysis_engine):
    """Test consumer initialization."""
    with patch('src.consumer.IrisClient'):
        consumer = AnalysisConsumer(mock_config, mock_analysis_engine)
        
        assert consumer.config == mock_config
        assert consumer.analysis_engine == mock_analysis_engine
        assert consumer.iris_client is None
        assert not consumer.is_running


@pytest.mark.asyncio
async def test_consumer_start_stop(analysis_consumer):
    """Test consumer start and stop."""
    # Mock client methods
    analysis_consumer.client.subscribe = AsyncMock()
    analysis_consumer.client.__aenter__ = AsyncMock(return_value=analysis_consumer.client)
    analysis_consumer.client.__aexit__ = AsyncMock()
    
    # Mock message iteration
    async def mock_message_iter():
        # This would normally yield messages, but we'll test without actual messages
        return
        yield  # This line is never reached
    
    with patch.object(analysis_consumer.client, 'unfiltered_messages', return_value=mock_message_iter()):
        # Test start consuming (this would normally start the loop)
        # We won't actually run this as it would block
        pass
    
    # Test stop
    await analysis_consumer.stop()
    
    # Verify client was cleaned up
    assert not analysis_consumer.is_running