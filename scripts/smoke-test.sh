#!/bin/bash
# Smoke test PlumeNote API
set -euo pipefail

BASE="${BASE_URL:-http://localhost:8080}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local status="$2"
  local expected="$3"
  if [ "$status" -eq "$expected" ]; then
    echo "[OK]   $name (HTTP $status)"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $name (HTTP $status, expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== PlumeNote Smoke Test ==="
echo "Target: $BASE"
echo ""

# Health
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")
check "GET /api/health" "$STATUS" 200

# Public domains
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/domains")
check "GET /api/domains" "$STATUS" 200

# Public config
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/config/ticket-url")
check "GET /api/config/ticket-url" "$STATUS" 200

# Documents list
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/documents")
check "GET /api/documents" "$STATUS" 200

# Search (should fail with short query)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/search?q=te")
check "GET /api/search?q=te (short)" "$STATUS" 400

# Login
echo ""
echo "=== Auth ==="
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin123!"}')
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -1)
check "POST /api/auth/login" "$STATUS" 200

TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")
if [ -z "$TOKEN" ]; then
  echo "[WARN] No token received, skipping authenticated tests"
else
  echo "Token: ${TOKEN:0:20}..."

  # Me
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auth/me" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/auth/me" "$STATUS" 200

  # Admin domains
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/domains" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/admin/domains" "$STATUS" 200

  # Admin templates
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/templates" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/admin/templates" "$STATUS" 200

  # Admin users
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/users" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/admin/users" "$STATUS" 200

  # Admin config
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/config/freshness" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/admin/config/freshness" "$STATUS" 200

  # Search with valid query
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/search?q=test" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/search?q=test" "$STATUS" 200
fi

echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
echo "All smoke tests passed!"
