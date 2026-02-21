"""Iris - RabbitMQ client for inter-service messaging"""

import pika
import json
from typing import Callable, Optional, Dict, Any
import structlog

logger = structlog.get_logger()


class IrisClient:
    """RabbitMQ client for publishing and consuming messages"""
    
    def __init__(self, url: str = "amqp://localhost:5672"):
        self.url = url
        self.connection = None
        self.channel = None
        self.exchange_name = "realpolitik.events"
    
    async def connect(self):
        """Establish RabbitMQ connection"""
        try:
            # Convert async to sync - pika is synchronous
            parameters = pika.URLParameters(self.url)
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            
            # Declare exchange
            self.channel.exchange_declare(
                exchange=self.exchange_name,
                exchange_type='topic',
                durable=True
            )
            
            logger.info("Iris connection established")
        except Exception as e:
            logger.error("Failed to connect to Iris", error=str(e))
            raise
    
    async def disconnect(self):
        """Close RabbitMQ connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info("Iris connection closed")
    
    async def publish_event(self, event_data: Dict[str, Any]):
        """Publish event to event.ingested topic"""
        try:
            # Create temporary queue for this publish
            result = self.channel.queue_declare(queue='', exclusive=True)
            callback_queue = result.method.queue
            
            # Publish message
            message_body = json.dumps(event_data, default=str)
            properties = pika.BasicProperties(
                message_id=str(event_data.get('id', '')),
                content_type='application/json',
                delivery_mode=2,  # Make message persistent
                timestamp=int(event_data.get('occurred_at', 0)) if event_data.get('occurred_at') else None
            )
            
            self.channel.basic_publish(
                exchange=self.exchange_name,
                routing_key='event.ingested',
                body=message_body,
                properties=properties
            )
            
            logger.info("Event published", routing_key='event.ingested', event_id=event_data.get('id'))
            
        except Exception as e:
            logger.error("Failed to publish event", error=str(e))
            raise
    
    async def publish_analysis_request(self, request_data: Dict[str, Any]):
        """Publish analysis request"""
        try:
            message_body = json.dumps(request_data, default=str)
            properties = pika.BasicProperties(
                message_id=str(request_data.get('request_id', '')),
                content_type='application/json',
                delivery_mode=2,
                priority=self._get_priority_level(request_data.get('priority', 'normal'))
            )
            
            self.channel.basic_publish(
                exchange=self.exchange_name,
                routing_key='analysis.requested',
                body=message_body,
                properties=properties
            )
            
            logger.info("Analysis request published", request_id=request_data.get('request_id'))
            
        except Exception as e:
            logger.error("Failed to publish analysis request", error=str(e))
            raise
    
    def consume_queue(self, queue_name: str, callback: Callable):
        """Start consuming from specified queue"""
        try:
            # Declare queue
            self.channel.queue_declare(queue=queue_name, durable=True)
            
            # Set up consumer
            self.channel.basic_qos(prefetch_count=1)
            
            def wrapper_callback(ch, method, properties, body):
                try:
                    message_data = json.loads(body.decode())
                    callback(message_data, properties)
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                except Exception as e:
                    logger.error("Consumer callback failed", error=str(e))
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
            
            self.channel.basic_consume(
                queue=queue_name,
                on_message_callback=wrapper_callback,
                auto_ack=False
            )
            
            logger.info("Started consuming", queue=queue_name)
            
        except Exception as e:
            logger.error("Failed to set up consumer", error=str(e))
            raise
    
    def start_consuming(self):
        """Start consuming messages (blocking)"""
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            logger.info("Consumer stopped by user")
            self.stop_consuming()
        except Exception as e:
            logger.error("Consumer error", error=str(e))
            raise
    
    def stop_consuming(self):
        """Stop consuming messages"""
        try:
            self.channel.stop_consuming()
            logger.info("Consumer stopped")
        except Exception as e:
            logger.error("Failed to stop consumer", error=str(e))
    
    def _get_priority_level(self, priority: str) -> int:
        """Convert priority string to RMQ priority number"""
        priority_map = {
            'low': 0,
            'normal': 1,
            'high': 2,
            'urgent': 3
        }
        return priority_map.get(priority, 1)
    
    async def test_connection(self) -> bool:
        """Test RabbitMQ connection"""
        try:
            self.channel.queue_declare(queue='test', passive=True)
            return True
        except Exception as e:
            logger.error("Connection test failed", error=str(e))
            return False
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()