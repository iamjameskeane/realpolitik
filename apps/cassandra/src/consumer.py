"""
RabbitMQ consumer for Cassandra microservice using Iris client.
"""

import asyncio
import json
import uuid
import structlog
from typing import Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

from models.requests import AnalysisRequest, AnalysisResponse
from models.events import EventSource
from analysis_engine import CassandraAnalysisEngine

logger = structlog.get_logger()


class AnalysisConsumer:
    """RabbitMQ consumer for analysis requests using Iris client."""

    def __init__(self, config, analysis_engine: CassandraAnalysisEngine):
        self.config = config
        self.analysis_engine = analysis_engine
        self.iris_client = None
        self.is_running = False

    async def connect(self) -> bool:
        """Connect to RabbitMQ using Iris client."""
        try:
            # Import Iris client from realpolitik-clients (installed via Poetry)
            from realpolitik_clients import IrisClient

            self.iris_client = IrisClient(self.config.rabbitmq_url)
            await self.iris_client.connect()

            logger.info("Connected to RabbitMQ via Iris client")
            return True

        except Exception as e:
            logger.error("Failed to connect to RabbitMQ", error=str(e))
            return False

    async def start_consuming(self):
        """Start consuming analysis requests."""
        if not self.iris_client:
            if not await self.connect():
                return

        self.is_running = True

        # Set up queue for analysis requests
        queue_name = self.config.rabbitmq_queue
        self.iris_client.channel.queue_declare(queue=queue_name, durable=True)
        self.iris_client.channel.basic_qos(prefetch_count=self.config.prefetch_count)

        logger.info("Started consuming from queue", queue=queue_name)

        try:
            def analysis_callback(ch, method, properties, body):
                """Handle incoming analysis request message."""
                try:
                    message_data = json.loads(body.decode())
                    request_id = message_data.get("request_id")
                    event_ids = message_data.get("event_ids", [])
                    priority = message_data.get("priority", "normal")

                    if not request_id or not event_ids:
                        logger.warning("Invalid message format", message_data=message_data)
                        ch.basic_ack(delivery_tag=method.delivery_tag)
                        return

                    logger.info("Received analysis request", request_id=request_id, event_count=len(event_ids))

                    # Create analysis request object
                    analysis_request = AnalysisRequest(
                        request_id=uuid.UUID(request_id),
                        event_ids=event_ids,
                        priority=priority,
                        user_id=message_data.get("user_id"),
                        webhook_url=message_data.get("webhook_url"),
                        metadata=message_data.get("metadata", {})
                    )

                    # Process analysis with retry logic
                    try:
                        result = asyncio.create_task(
                            self._process_analysis_with_retry(analysis_request)
                        )

                        if result.result():
                            logger.info("Analysis completed", request_id=request_id)
                            # Note: Result publishing would need to be implemented
                            # This could update status in Redis cache for Delphi to read
                        else:
                            logger.error("Analysis failed", request_id=request_id)

                    except Exception as e:
                        logger.error("Analysis processing failed", request_id=request_id, error=str(e))

                    # Acknowledge message
                    ch.basic_ack(delivery_tag=method.delivery_tag)

                except Exception as e:
                    logger.error("Message handling failed", error=str(e))
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

            # Set up consumer
            self.iris_client.channel.basic_consume(
                queue=queue_name,
                on_message_callback=analysis_callback,
                auto_ack=False
            )

            # Start consuming (blocking call)
            self.iris_client.start_consuming()

        except Exception as e:
            logger.error("Consumer error", error=str(e))
        finally:
            await self.stop()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def _process_analysis_with_retry(self, request: AnalysisRequest) -> Optional[AnalysisResponse]:
        """Process analysis with retry logic."""
        return await self.analysis_engine.process_analysis_request(request)

    async def stop(self):
        """Stop consuming and disconnect."""
        self.is_running = False

        if self.iris_client:
            try:
                self.iris_client.stop_consuming()
                await self.iris_client.disconnect()
                logger.info("RabbitMQ connection closed")
            except Exception as e:
                logger.error("Error closing RabbitMQ connection", error=str(e))

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()