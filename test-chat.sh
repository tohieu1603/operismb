#!/bin/bash
# Test chat API with Anthropic-style response

API_URL="http://localhost:3025"
EMAIL="admin@operis.vn"
PASSWORD="admin123"

echo "=== Login ==="
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Login failed!"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "Token: ${TOKEN:0:50}..."

echo ""
echo "=== Test 1: mở youtube ==="
curl -s -X POST "$API_URL/api/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"mở youtube"}' | jq .

echo ""
echo "=== Test 2: tìm kiếm AI trên google ==="
curl -s -X POST "$API_URL/api/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"tìm kiếm về AI trên google"}' | jq .

echo ""
echo "=== Test 3: chào (no tool) ==="
curl -s -X POST "$API_URL/api/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"xin chào"}' | jq .
