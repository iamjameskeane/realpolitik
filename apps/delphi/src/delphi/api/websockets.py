"""WebSocket endpoints for real-time communication"""

import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Set
from uuid import UUID, uuid4

from fastapi import WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.responses import JSONResponse
import structlog

from ..core.auth import get_current_user
from ..deps.cache import get_lethe_client

logger = structlog.get_logger()

class ConnectionManager:
    """WebSocket connection manager for real-time communication"""
    
    def __init__(self):
        # Active connections organized by session
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_connections: Dict[str, Set[str]] = {}  # user_id -> session_ids
        self.session_data: Dict[str, Dict[str, Any]] = {}  # session metadata
    
    async def connect(self, websocket: WebSocket, session_id: str, user: Dict[str, Any]):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        
        # Add to connections
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)
        
        # Track user connections
        user_id = user.get("sub")
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(session_id)
        
        # Initialize session data
        if session_id not in self.session_data:
            self.session_data[session_id] = {
                "created_at": datetime.utcnow(),
                "user_id": user_id,
                "message_count": 0
            }
        
        logger.info(
            "WebSocket connected",
            session_id=session_id,
            user_id=user_id,
            total_connections=len(self.active_connections[session_id])
        )
    
    def disconnect(self, websocket: WebSocket, session_id: str):
        """Remove a WebSocket connection"""
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            
            # Clean up empty sessions
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                
                # Clean up user connections
                user_id = self.session_data.get(session_id, {}).get("user_id")
                if user_id and user_id in self.user_connections:
                    self.user_connections[user_id].discard(session_id)
                    if not self.user_connections[user_id]:
                        del self.user_connections[user_id]
                
                # Clean up session data
                if session_id in self.session_data:
                    del self.session_data[session_id]
        
        logger.info("WebSocket disconnected", session_id=session_id)
    
    async def send_personal_message(self, message: Dict[str, Any], user_id: str):
        """Send message to all connections for a specific user"""
        if user_id in self.user_connections:
            for session_id in self.user_connections[user_id]:
                await self.send_to_session(session_id, message)
    
    async def send_to_session(self, session_id: str, message: Dict[str, Any]):
        """Send message to all connections in a session"""
        if session_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_text(json.dumps(message))
                    # Update message count
                    if session_id in self.session_data:
                        self.session_data[session_id]["message_count"] += 1
                except WebSocketDisconnect:
                    disconnected.append(connection)
                except Exception as e:
                    logger.error("Failed to send WebSocket message", error=str(e))
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn, session_id)
    
    async def broadcast_to_session(self, session_id: str, message: Dict[str, Any], exclude: WebSocket = None):
        """Broadcast message to all connections in a session except exclude"""
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                if connection != exclude:
                    try:
                        await connection.send_text(json.dumps(message))
                    except WebSocketDisconnect:
                        self.disconnect(connection, session_id)
                    except Exception as e:
                        logger.error("Failed to broadcast WebSocket message", error=str(e))
                        self.disconnect(connection, session_id)
    
    def get_session_stats(self, session_id: str) -> Dict[str, Any]:
        """Get statistics for a session"""
        if session_id in self.session_data:
            stats = self.session_data[session_id].copy()
            stats["active_connections"] = len(self.active_connections.get(session_id, set()))
            return stats
        return {}

# Global connection manager
manager = ConnectionManager()

# WebSocket endpoint for chat sessions
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time chat communication"""
    try:
        # Authenticate user
        user = await get_current_user()
        
        # Connect
        await manager.connect(websocket, session_id, user)
        
        # Send welcome message
        await manager.send_to_session(session_id, {
            "type": "welcome",
            "session_id": session_id,
            "user_id": user.get("sub"),
            "timestamp": datetime.utcnow().isoformat(),
            "stats": manager.get_session_stats(session_id)
        })
        
        # Handle incoming messages
        while True:
            try:
                # Receive message
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Process message based on type
                message_type = message_data.get("type")
                
                if message_type == "chat_message":
                    await handle_chat_message(session_id, message_data, user)
                elif message_type == "analysis_update":
                    await handle_analysis_update(session_id, message_data, user)
                elif message_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "timestamp": datetime.utcnow().isoformat()}))
                else:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"Unknown message type: {message_type}"
                    }))
                
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error("WebSocket message handling error", error=str(e))
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Internal server error"
                }))
    
    except HTTPException as e:
        await websocket.close(code=4001, reason=str(e.detail))
    except Exception as e:
        logger.error("WebSocket connection error", error=str(e))
        await websocket.close(code=4000, reason="Connection error")
    finally:
        manager.disconnect(websocket, session_id)

async def handle_chat_message(session_id: str, message_data: Dict[str, Any], user: Dict[str, Any]):
    """Handle incoming chat messages"""
    try:
        message_id = str(uuid4())
        user_id = user.get("sub")
        
        # Validate message
        content = message_data.get("content", "").strip()
        if not content:
            await manager.send_to_session(session_id, {
                "type": "error",
                "message": "Message content cannot be empty"
            })
            return
        
        # Create message object
        chat_message = {
            "type": "chat_message",
            "message_id": message_id,
            "session_id": session_id,
            "user_id": user_id,
            "user_role": user.get("role", "user"),
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Store message in cache (for session persistence)
        lethe = get_lethe_client()
        session_key = f"chat_session:{session_id}"
        cached_session = await lethe.get_session(session_key) or {"messages": []}
        cached_session["messages"].append(chat_message)
        
        # Limit message history
        if len(cached_session["messages"]) > 100:
            cached_session["messages"] = cached_session["messages"][-100:]
        
        await lethe.store_session(session_key, cached_session, ttl=3600)
        
        # Broadcast message to session
        await manager.broadcast_to_session(session_id, chat_message)
        
        logger.info(
            "Chat message sent",
            session_id=session_id,
            user_id=user_id,
            message_id=message_id
        )
        
    except Exception as e:
        logger.error("Failed to handle chat message", error=str(e))
        await manager.send_to_session(session_id, {
            "type": "error",
            "message": "Failed to send message"
        })

async def handle_analysis_update(session_id: str, message_data: Dict[str, Any], user: Dict[str, Any]):
    """Handle analysis progress updates"""
    try:
        analysis_id = message_data.get("analysis_id")
        if not analysis_id:
            await manager.send_to_session(session_id, {
                "type": "error", 
                "message": "Analysis ID required"
            })
            return
        
        # In a real implementation, this would check analysis status
        # For now, send a mock progress update
        progress_update = {
            "type": "analysis_progress",
            "analysis_id": analysis_id,
            "progress": 0.75,
            "status": "processing",
            "message": "Analyzing causal relationships...",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send only to the requesting user
        user_id = user.get("sub")
        await manager.send_personal_message(progress_update, user_id)
        
    except Exception as e:
        logger.error("Failed to handle analysis update", error=str(e))

# Public WebSocket endpoints
async def chat_websocket(websocket: WebSocket, session_id: str):
    """Public chat WebSocket endpoint"""
    await websocket_endpoint(websocket, session_id)

async def analysis_websocket(websocket: WebSocket, analysis_id: str):
    """Analysis progress WebSocket endpoint"""
    session_id = f"analysis_{analysis_id}"
    await websocket_endpoint(websocket, session_id)

# Helper functions for sending updates
async def notify_analysis_complete(user_id: str, analysis_id: str, result: Dict[str, Any]):
    """Notify user that analysis is complete"""
    await manager.send_personal_message({
        "type": "analysis_complete",
        "analysis_id": analysis_id,
        "result": result,
        "timestamp": datetime.utcnow().isoformat()
    }, user_id)

async def notify_new_events(user_id: str, events: list):
    """Notify user of new events"""
    await manager.send_personal_message({
        "type": "new_events",
        "events": events,
        "count": len(events),
        "timestamp": datetime.utcnow().isoformat()
    }, user_id)

# Connection stats endpoint
def get_connection_stats() -> Dict[str, Any]:
    """Get WebSocket connection statistics"""
    return {
        "total_sessions": len(manager.active_connections),
        "total_connections": sum(len(conns) for conns in manager.active_connections.values()),
        "active_users": len(manager.user_connections),
        "sessions": {
            session_id: manager.get_session_stats(session_id)
            for session_id in manager.active_connections.keys()
        }
    }