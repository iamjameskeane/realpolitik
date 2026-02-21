#!/bin/bash
echo "🚀 Styx Gateway Demo"
echo "=================="
echo ""
echo "1. Gateway Status:"
curl -s http://localhost:8080/ | jq .
echo ""
echo "2. Health Check:"  
curl -s http://localhost:8080/health | jq .
echo ""
echo "3. Route Requests (show what gets routed where):"
echo "   - GET /api/v1/events → Routes to Delphi (port 8000)"
echo "   - GET /mcp/v1/tools  → Routes to Hermes (port 8002)"
echo "   - GET /ws/chat/test  → Routes to Pythia (port 8001)"
echo ""
echo "4. Styx logs show routing decisions in real-time"
