#!/usr/bin/env bash
# openclaw-sync.sh — Client-side script to sync/clear auth-profiles.json
# Runs on the CLIENT machine where OpenClaw gateway is installed.
#
# Usage:
#   ./openclaw-sync.sh sync    # Login + pull tokens → write auth-profiles.json
#   ./openclaw-sync.sh clear   # Clear auth-profiles.json (logout)
#
# Environment variables (or will prompt):
#   OPERIS_API_URL    — API server URL (e.g. https://api.operis.vn)
#   OPERIS_EMAIL      — Login email
#   OPERIS_PASSWORD   — Login password
#   AUTH_PROFILES_PATH — Where to write auth-profiles.json (auto-detected if not set)

set -euo pipefail

# Auto-detect auth-profiles.json path
detect_auth_profiles_path() {
  local default_path="$HOME/.openclaw/agents/main/agent/auth-profiles.json"
  if [ -f "$default_path" ]; then
    echo "$default_path"
    return
  fi
  # Search common locations
  for dir in "$HOME/.openclaw/agents"/*/agent; do
    if [ -f "$dir/auth-profiles.json" ]; then
      echo "$dir/auth-profiles.json"
      return
    fi
  done
  echo "$default_path"
}

AUTH_PROFILES_PATH="${AUTH_PROFILES_PATH:-$(detect_auth_profiles_path)}"

cmd="${1:-sync}"

case "$cmd" in
  sync)
    # Prompt for missing values (only needed for sync)
    if [ -z "${OPERIS_API_URL:-}" ]; then
      read -rp "API URL (e.g. https://api.operis.vn): " OPERIS_API_URL
    fi
    OPERIS_API_URL="${OPERIS_API_URL%/}"

    if [ -z "${OPERIS_EMAIL:-}" ]; then
      read -rp "Email: " OPERIS_EMAIL
    fi
    if [ -z "${OPERIS_PASSWORD:-}" ]; then
      read -rsp "Password: " OPERIS_PASSWORD
      echo
    fi

    # 1. Login
    echo "[sync] Logging in as $OPERIS_EMAIL..."
    LOGIN_RESP=$(curl -sf -X POST "$OPERIS_API_URL/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$OPERIS_EMAIL\",\"password\":\"$OPERIS_PASSWORD\"}")

    TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)
    if [ -z "$TOKEN" ]; then
      echo "[sync] ERROR: Login failed"
      exit 1
    fi
    echo "[sync] Login OK"

    # 2. Pull auth-profiles content
    echo "[sync] Pulling tokens from vault..."
    PROFILES=$(curl -sf "$OPERIS_API_URL/api/token-vault/auth-profiles" \
      -H "Authorization: Bearer $TOKEN")

    if [ -z "$PROFILES" ]; then
      echo "[sync] ERROR: Failed to pull tokens"
      exit 1
    fi

    # 3. Write to file
    mkdir -p "$(dirname "$AUTH_PROFILES_PATH")"
    echo "$PROFILES" | python3 -m json.tool > "$AUTH_PROFILES_PATH"
    COUNT=$(echo "$PROFILES" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('profiles',{})))" 2>/dev/null)
    echo "[sync] Written $COUNT profile(s) → $AUTH_PROFILES_PATH"
    ;;

  clear)
    # Write empty profiles
    mkdir -p "$(dirname "$AUTH_PROFILES_PATH")"
    echo '{"version":1,"profiles":{},"lastGood":{}}' | python3 -m json.tool > "$AUTH_PROFILES_PATH"
    echo "[clear] auth-profiles.json cleared → $AUTH_PROFILES_PATH"
    ;;

  *)
    echo "Usage: $0 {sync|clear}"
    exit 1
    ;;
esac
