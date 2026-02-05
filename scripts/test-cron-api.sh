#!/bin/bash
# Test Operis Cron API with Moltbot-compatible fields
# Usage: ./scripts/test-cron-api.sh [port] [email] [password]

PORT=${1:-3025}
EMAIL=${2:-"admin@operis.vn"}
PASSWORD=${3:-"admin123"}
BASE_URL="http://localhost:$PORT/api"

echo "=== Operis Cron API Test ==="
echo "Base URL: $BASE_URL"
echo ""

# Login first
echo ">>> Logging in..."
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESP" | jq -r '.accessToken // empty')
if [ -z "$TOKEN" ]; then
  echo "Login failed: $LOGIN_RESP"
  exit 1
fi
echo "Logged in successfully"
echo ""

# Test 1: Create cronjob with Moltbot fields
echo ">>> Test 1: Create cronjob with Moltbot-compatible fields"
CREATE_RESP=$(curl -s -X POST "$BASE_URL/cron" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Moltbot Cron",
    "description": "Test cronjob with all Moltbot fields",
    "schedule_type": "cron",
    "schedule_expr": "*/5 * * * *",
    "schedule_tz": "Asia/Ho_Chi_Minh",
    "session_target": "main",
    "wake_mode": "now",
    "message": "Xin chào, đây là test cronjob từ Operis API",
    "model": "claude-sonnet-4-20250514",
    "thinking": "low",
    "timeout_seconds": 60,
    "deliver": true,
    "channel": "last",
    "enabled": true
  }')

echo "Response: $(echo "$CREATE_RESP" | jq .)"
CRON_ID=$(echo "$CREATE_RESP" | jq -r '.id // empty')
echo ""

if [ -z "$CRON_ID" ]; then
  echo "Failed to create cronjob"
  exit 1
fi

# Test 2: Get cronjob
echo ">>> Test 2: Get cronjob details"
curl -s "$BASE_URL/cron/$CRON_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 3: Run cronjob manually
echo ">>> Test 3: Run cronjob manually (calls /hooks/agent)"
RUN_RESP=$(curl -s -X POST "$BASE_URL/cron/$CRON_ID/run" \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $(echo "$RUN_RESP" | jq .)"
echo ""

# Test 4: Get executions
echo ">>> Test 4: Get execution history"
curl -s "$BASE_URL/cron/$CRON_ID/executions" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 5: Create "every" type cronjob
echo ">>> Test 5: Create 'every' type cronjob (run every 2 minutes)"
curl -s -X POST "$BASE_URL/cron" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Every 2 Minutes Job",
    "schedule_type": "every",
    "schedule_expr": "every 2 minutes",
    "schedule_interval_ms": 120000,
    "session_target": "isolated",
    "wake_mode": "next-heartbeat",
    "message": "Check system status",
    "deliver": false,
    "enabled": false
  }' | jq .
echo ""

# Test 6: Create "at" type cronjob (one-time)
FUTURE_TS=$(($(date +%s) * 1000 + 3600000))
echo ">>> Test 6: Create 'at' type cronjob (one-time, 1 hour from now)"
curl -s -X POST "$BASE_URL/cron" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"One-time Reminder\",
    \"schedule_type\": \"at\",
    \"schedule_expr\": \"at specific time\",
    \"schedule_at_ms\": $FUTURE_TS,
    \"session_target\": \"main\",
    \"wake_mode\": \"now\",
    \"message\": \"Reminder: Check your tasks!\",
    \"delete_after_run\": true,
    \"enabled\": true
  }" | jq .
echo ""

# Test 7: List all cronjobs
echo ">>> Test 7: List all cronjobs"
curl -s "$BASE_URL/cron" \
  -H "Authorization: Bearer $TOKEN" | jq '.cronjobs[] | {id, name, schedule_type, enabled, next_run_at}'
echo ""

# Cleanup - delete test cronjobs
echo ">>> Cleanup: Delete test cronjob"
curl -s -X DELETE "$BASE_URL/cron/$CRON_ID" \
  -H "Authorization: Bearer $TOKEN"
echo "Deleted cronjob $CRON_ID"
echo ""

echo "=== Test Complete ==="
