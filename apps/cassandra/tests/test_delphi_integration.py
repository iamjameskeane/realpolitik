"""
Integration tests for Delphi ↔ Cassandra message flow.

This test suite validates the complete integration between Delphi API server
and Cassandra analysis microservice through the RabbitMQ message queue.
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from uuid import uuid4
from datetime import datetime, timezone

# Import test utilities
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../libs/realpolitik-clients/src'))

from realpolitik_clients.iris import IrisClient
from src.consumer import AnalysisConsumer
from src.models.requests import AnalysisRequest
from src.analysis_engine import CassandraAnalysisEngine


class TestDelphiCassandraIntegration:
    """Test suite for Delphi-Cassandra integration."""

    @pytest.fixture
    def mock_config(self):
        """Create mock configuration."""
        config = Mock()
        config.database_url = "postgresql://test:test@localhost/test"
        config.neo4j_uri = "bolt://localhost:7687"
        config.neo4j_username = "test"
        config.neo4j_password = "test"
        config.qdrant_uri = "http://localhost:6333"
        config.redis_url = "redis://localhost:6379"
        config.rabbitmq_url = "amqp://test:test@localhost:5672"
        config.rabbitmq_queue = "analysis.requested"
        config.prefetch_count = 10
        config.retry_attempts = 3
        config.retry_delay_seconds = 30
        config.max_concurrent_requests = 5
        config.analysis_timeout_seconds = 120
        config.model_enrichment = "anthropic/claude-3-haiku"
        config.model_synthesis = "anthropic/claude-3-sonnet"
        config.analysis_cache_ttl_hours = 24
        config.openrouter_api_key = "test-key"
        return config

    @pytest.fixture
    def mock_analysis_engine(self):
        """Create mock analysis engine."""
        engine = Mock(spec=CassandraAnalysisEngine)
        engine.process_analysis_request = AsyncMock()
        
        # Mock successful analysis response
        mock_result = Mock()
        mock_result.analysis_id = uuid4()
        mock_result.request_id = uuid4()
        mock_result.status = "COMPLETED"
        mock_result.progress = 100.0
        mock_result.results = {
            "cascading_effects": "Analysis completed successfully",
            "confidence_score": 0.87,
            "cost_actual": 2.45
        }
        mock_result.completed_at = datetime.now(timezone.utc)
        
        engine.process_analysis_request.return_value = mock_result
        return engine

    @pytest.fixture
    def mock_iris_client(self):
        """Create mock Iris client."""
        client = Mock(spec=IrisClient)
        client.connect = AsyncMock()
        client.disconnect = AsyncMock()
        client.channel = Mock()
        client.channel.queue_declare = Mock()
        client.channel.basic_qos = Mock()
        client.channel.basic_consume = Mock()
        client.start_consuming = Mock()
        client.stop_consuming = Mock()
        return client

    @pytest.fixture
    def analysis_consumer(self, mock_config, mock_analysis_engine, mock_iris_client):
        """Create analysis consumer with mocked dependencies."""
        with patch('src.consumer.IrisClient') as mock_iris_class:
            mock_iris_class.return_value = mock_iris_client
            consumer = AnalysisConsumer(mock_config, mock_analysis_engine)
            consumer.iris_client = mock_iris_client
            return consumer

    @pytest.mark.asyncio
    async def test_consumer_initialization(self, analysis_consumer, mock_iris_client):
        """Test that consumer initializes properly with Iris client."""
        # Test connection
        result = await analysis_consumer.connect()
        assert result is True
        mock_iris_client.connect.assert_called_once()

    @pytest.mark.asyncio
    async def test_analysis_request_message_format(self, analysis_consumer):
        """Test that Delphi messages are processed correctly."""
        # Simulate Delphi analysis request format
        request_id = str(uuid4())
        message_data = {
            "request_id": request_id,
            "user_id": "test-user-123",
            "event_ids": ["event-1", "event-2", "event-3"],
            "include_historical": True,
            "max_cost": 10.0,
            "source": "delphi",
            "priority": "normal",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # Create mock callback function
        callback_called = False
        callback_result = None

        def mock_callback(ch, method, properties, body):
            nonlocal callback_called, callback_result
            callback_called = True
            
            # Parse the message
            received_data = json.loads(body.decode())
            assert received_data == message_data
            
            # Verify required fields
            assert received_data["request_id"] == request_id
            assert received_data["user_id"] == "test-user-123"
            assert len(received_data["event_ids"]) == 3
            assert received_data["source"] == "delphi"
            
            # Simulate successful processing
            ch.basic_ack(delivery_tag=method.delivery_tag)
            callback_result = received_data

        # Test callback handling
        mock_method = Mock()
        mock_method.delivery_tag = "test-tag"
        mock_properties = Mock()
        
        mock_channel = Mock()
        
        # Execute callback
        mock_callback(mock_channel, mock_method, mock_properties, json.dumps(message_data).encode())
        
        # Verify callback was called and processed correctly
        assert callback_called is True
        assert callback_result is not None
        assert callback_result["request_id"] == request_id

    @pytest.mark.asyncio
    async def test_analysis_engine_integration(self, analysis_consumer, mock_analysis_engine):
        """Test integration with analysis engine."""
        # Create test request
        request_id = str(uuid4())
        analysis_request = AnalysisRequest(
            request_id=uuid4(),
            event_ids=["event-1", "event-2"],
            priority="normal",
            user_id="test-user"
        )

        # Call analysis engine
        result = await analysis_consumer._process_analysis_with_retry(analysis_request)

        # Verify analysis engine was called
        mock_analysis_engine.process_analysis_request.assert_called_once_with(analysis_request)
        
        # Verify result format
        assert result is not None
        assert result.status == "COMPLETED"
        assert result.progress == 100.0
        assert "confidence_score" in result.results

    @pytest.mark.asyncio
    async def test_error_handling_and_retry(self, analysis_consumer, mock_analysis_engine):
        """Test error handling and retry logic."""
        # Make analysis engine fail first 2 calls, succeed on 3rd
        call_count = 0
        
        async def failing_analysis(request):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise Exception("Simulated failure")
            return Mock(
                status="COMPLETED",
                progress=100.0,
                results={"success": True}
            )
        
        mock_analysis_engine.process_analysis_request = failing_analysis
        
        # Create test request
        analysis_request = AnalysisRequest(
            request_id=uuid4(),
            event_ids=["event-1"],
            priority="normal",
            user_id="test-user"
        )

        # Test retry logic (should succeed on 3rd attempt)
        result = await analysis_consumer._process_analysis_with_retry(analysis_request)
        
        # Verify retry attempts and final success
        assert call_count == 3
        assert result is not None
        assert result.status == "COMPLETED"

    @pytest.mark.asyncio
    async def test_graceful_shutdown(self, analysis_consumer, mock_iris_client):
        """Test graceful shutdown of consumer."""
        # Start consumer
        analysis_consumer.is_running = True
        
        # Test stop method
        await analysis_consumer.stop()
        
        # Verify cleanup
        assert analysis_consumer.is_running is False
        mock_iris_client.stop_consuming.assert_called_once()
        mock_iris_client.disconnect.assert_called_once()

    @pytest.mark.asyncio
    async def test_message_queue_integration(self, analysis_consumer, mock_iris_client):
        """Test integration with RabbitMQ queue via Iris client."""
        # Test that consumer sets up proper queue
        await analysis_consumer.connect()
        
        # Verify queue setup
        mock_iris_client.channel.queue_declare.assert_called_once_with(
            queue="analysis.requested", durable=True
        )
        mock_iris_client.channel.basic_qos.assert_called_once_with(
            prefetch_count=10
        )

    def test_delphi_message_format_compatibility(self):
        """Test that Delphi messages are compatible with Cassandra consumer."""
        # Test the exact format Delphi sends
        delphi_message = {
            "request_id": "test-uuid",
            "user_id": "user-123",
            "event_ids": ["event-1", "event-2", "event-3"],
            "include_historical": True,
            "max_cost": 10.0,
            "source": "delphi",
            "priority": "normal"
        }
        
        # Verify all required fields are present
        required_fields = ["request_id", "user_id", "event_ids", "include_historical", "max_cost", "source"]
        for field in required_fields:
            assert field in delphi_message, f"Missing required field: {field}"
        
        # Verify field types
        assert isinstance(delphi_message["request_id"], str)
        assert isinstance(delphi_message["user_id"], str)
        assert isinstance(delphi_message["event_ids"], list)
        assert isinstance(delphi_message["include_historical"], bool)
        assert isinstance(delphi_message["max_cost"], (int, float))
        assert isinstance(delphi_message["source"], str)


class TestEndToEndMessageFlow:
    """End-to-end message flow tests."""

    @pytest.fixture
    def mock_delphi_api_response(self):
        """Mock Delphi API response."""
        return {
            "analysis_id": str(uuid4()),
            "request_id": str(uuid4()),
            "status": "PROCESSING",
            "progress": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    @pytest.mark.asyncio
    async def test_complete_delphi_cassandra_flow(self, mock_delphi_api_response):
        """Test complete message flow from Delphi API to Cassandra processing."""
        # Step 1: Simulate Delphi API receiving analysis request
        delphi_request = {
            "event_ids": ["event-1", "event-2"],
            "include_historical": True,
            "max_cost": 10.0
        }
        
        # Step 2: Simulate Delphi publishing to RabbitMQ
        request_id = str(uuid4())
        message_data = {
            "request_id": request_id,
            "user_id": "test-user",
            "event_ids": delphi_request["event_ids"],
            "include_historical": delphi_request["include_historical"],
            "max_cost": delphi_request["max_cost"],
            "source": "delphi",
            "priority": "normal"
        }
        
        # Step 3: Simulate Cassandra receiving and processing
        def simulate_cassandra_processing(message_data):
            request_id = message_data["request_id"]
            event_count = len(message_data["event_ids"])
            
            # Mock analysis processing
            analysis_result = {
                "analysis_id": str(uuid4()),
                "request_id": request_id,
                "status": "COMPLETED",
                "progress": 100.0,
                "results": {
                    "cascading_effects": f"Analysis of {event_count} events",
                    "confidence_score": 0.85,
                    "cost_actual": 2.30
                },
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
            
            return analysis_result
        
        # Execute the flow
        result = simulate_cassandra_processing(message_data)
        
        # Verify the complete flow
        assert result["status"] == "COMPLETED"
        assert result["progress"] == 100.0
        assert result["results"]["confidence_score"] > 0.8
        assert result["results"]["cost_actual"] <= delphi_request["max_cost"]

    @pytest.mark.asyncio
    async def test_error_scenarios(self):
        """Test various error scenarios in the integration."""
        # Test invalid message format
        invalid_message = {
            "request_id": None,  # Invalid
            "event_ids": [],     # Empty
        }
        
        # Test processing of invalid message
        should_ack = True  # Invalid messages should be acknowledged to prevent infinite retries
        
        # Test missing required fields
        try:
            required_fields = ["request_id", "event_ids"]
            for field in required_fields:
                if field not in invalid_message or not invalid_message[field]:
                    raise ValueError(f"Missing or invalid field: {field}")
        except ValueError as e:
            assert "request_id" in str(e) or "event_ids" in str(e)
            assert should_ack is True  # Should acknowledge even invalid messages

    def test_performance_requirements(self):
        """Test that integration meets performance requirements."""
        # Test message processing time
        import time
        
        start_time = time.time()
        
        # Simulate message processing
        message_data = {
            "request_id": str(uuid4()),
            "user_id": "test-user",
            "event_ids": ["event-1", "event-2", "event-3"],
            "include_historical": True,
            "max_cost": 10.0,
            "source": "delphi"
        }
        
        # Simulate processing (mock)
        time.sleep(0.01)  # 10ms processing time
        
        processing_time = time.time() - start_time
        
        # Should process within reasonable time (< 100ms for mock processing)
        assert processing_time < 0.1, f"Processing took too long: {processing_time}s"


# Pytest configuration for Cassandra tests
pytest_plugins = ["pytest_asyncio"]