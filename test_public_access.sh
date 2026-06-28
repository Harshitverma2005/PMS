#!/bin/bash
echo "Testing public access to backend..."
echo "Public URL: http://14.194.19.29:8003"
echo ""
echo "Testing from external source..."
curl -s --max-time 10 http://14.194.19.29:8003/health && echo -e "\n✅ SUCCESS: Backend is publicly accessible!" || echo -e "\n❌ FAILED: Port forwarding not configured yet"
