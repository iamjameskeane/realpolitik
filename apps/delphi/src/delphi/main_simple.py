"""Enhanced Delphi demo with API v1 routing"""

import sys
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Set
import json
import uvicorn
import asyncio
from datetime import datetime
from uuid import uuid4

# Add path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Simple mock auth
def get_current_user():
    return {
        "sub": "demo-user",
        "email": "demo@example.com",
        "role": "analyst",
        "permissions": ["read:events", "read:entities", "request:analysis"]
    }

# Mock events data
MOCK_EVENTS = [
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

# Simple WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
    
    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

# Create FastAPI app with enhanced configuration
app = FastAPI(
    title="Delphi API Server",
    description="Application server for Realpolitik Geopolitical Intelligence Platform",
    version="1.0.0",
    docs_url="/docs" if True else None,  # Always show docs for demo
    redoc_url="/redoc" if True else None,
    openapi_tags=[
        {
            "name": "Health",
            "description": "Health check and monitoring endpoints"
        },
        {
            "name": "Events", 
            "description": "Geopolitical events management"
        },
        {
            "name": "Analysis",
            "description": "Fallout analysis requests and results"
        },
        {
            "name": "WebSocket",
            "description": "Real-time communication endpoints"
        },
        {
            "name": "Admin",
            "description": "Administrative and monitoring endpoints"
        }
    ]
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "delphi",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health/detailed", tags=["Health"])
async def detailed_health_check():
    return {
        "status": "healthy",
        "service": "delphi",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime": "demo",
        "connections": {
            "websocket": len(manager.active_connections)
        },
        "system": {
            "cpu_usage": "5.2%",
            "memory_usage": "45.1%",
            "disk_usage": "12.3%"
        }
    }

@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    return {"status": "ready"}

@app.get("/health/live", tags=["Health"]) 
async def liveness_check():
    return {"status": "alive"}

# Enhanced API v1 endpoints
@app.get("/api/v1/version", tags=["API"])
async def get_version_info():
    """Get API version information"""
    return {
        "version": "1.0.0",
        "api_version": "v1",
        "service": "delphi",
        "timestamp": datetime.utcnow().isoformat(),
        "features": ["events", "entities", "analysis", "websockets", "health_checks"]
    }

@app.get("/api/v1/ping", tags=["API"])
async def ping():
    """Simple ping endpoint for monitoring"""
    return {
        "pong": True,
        "timestamp": datetime.utcnow().isoformat(),
        "service": "delphi"
    }

# Original endpoints for backward compatibility
@app.get("/api/v1/events", tags=["Events"])
async def list_events(limit: int = 50):
    user = get_current_user()
    return {
        "events": MOCK_EVENTS[:limit],
        "total": len(MOCK_EVENTS),
        "limit": limit,
        "user": user
    }

@app.get("/api/v1/events/{event_id}", tags=["Events"])
async def get_event(event_id: str):
    user = get_current_user()
    event = next((e for e in MOCK_EVENTS if e["id"] == event_id), None)
    
    if not event:
        return {"error": "Event not found"}
    
    return {
        "event": event,
        "user": user
    }

@app.post("/api/v1/analysis/request", tags=["Analysis"])
async def request_analysis():
    user = get_current_user()
    request_id = str(uuid4())
    
    # Simulate analysis progress updates
    asyncio.create_task(simulate_analysis_progress(request_id))
    
    return {
        "request_id": request_id,
        "status": "processing",
        "user": user,
        "message": "Analysis request submitted successfully"
    }

# WebSocket endpoints
@app.websocket("/ws/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    await manager.connect(websocket)
    try:
        # Send welcome message
        await websocket.send_text(json.dumps({
            "type": "welcome",
            "session_id": session_id,
            "timestamp": datetime.utcnow().isoformat(),
            "features": ["chat", "analysis_updates"]
        }))
        
        # Handle messages
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "chat_message":
                # Echo message back with timestamp
                response = {
                    "type": "chat_message",
                    "message_id": str(uuid4()),
                    "content": message_data.get("content", ""),
                    "timestamp": datetime.utcnow().isoformat(),
                    "session_id": session_id
                }
                await websocket.send_text(json.dumps(response))
            elif message_data.get("type") == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                }))
            elif message_data.get("type") == "analysis_status":
                # Query analysis status
                analysis_id = message_data.get("analysis_id")
                if analysis_id:
                    await websocket.send_text(json.dumps({
                        "type": "analysis_status",
                        "analysis_id": analysis_id,
                        "status": "processing",
                        "progress": 0.75,
                        "timestamp": datetime.utcnow().isoformat()
                    }))
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.websocket("/ws/analysis/{analysis_id}")
async def websocket_analysis(websocket: WebSocket, analysis_id: str):
    await manager.connect(websocket)
    try:
        # Send initial status
        await websocket.send_text(json.dumps({
            "type": "analysis_started",
            "analysis_id": analysis_id,
            "timestamp": datetime.utcnow().isoformat()
        }))
        
        # Handle messages
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "analysis_id": analysis_id,
                    "timestamp": datetime.utcnow().isoformat()
                }))
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Demo analysis progress simulation
async def simulate_analysis_progress(request_id: str):
    """Simulate analysis progress updates"""
    steps = [
        (0.2, "Fetching event data..."),
        (0.4, "Analyzing relationships..."),
        (0.6, "Identifying stakeholders..."),
        (0.8, "Generating impact assessment..."),
        (1.0, "Analysis complete!")
    ]
    
    for progress, message in steps:
        await asyncio.sleep(2)  # Wait 2 seconds between updates
        await manager.broadcast({
            "type": "analysis_progress",
            "request_id": request_id,
            "progress": progress,
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        })

# Admin endpoints
@app.get("/api/admin/websocket/stats", tags=["Admin"])
async def get_websocket_stats():
    return {
        "active_connections": len(manager.active_connections),
        "total_connections": len(manager.active_connections),
        "timestamp": datetime.utcnow().isoformat(),
        "connection_details": {
            "chat_sessions": 0,
            "analysis_sessions": 0
        }
    }

@app.get("/api/admin/system/info", tags=["Admin"])
async def get_system_info():
    """Get system information for admin dashboard"""
    return {
        "service": {
            "name": "delphi",
            "version": "1.0.0",
            "status": "operational",
            "uptime": "demo"
        },
        "resources": {
            "cpu": {"usage_percent": 5.2, "cores": 4},
            "memory": {"usage_percent": 45.1, "total_gb": 8},
            "disk": {"usage_percent": 12.3, "total_gb": 100}
        },
        "endpoints": {
            "total": 15,
            "active": 15,
            "deprecated": 0
        },
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(
        "main_simple:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )