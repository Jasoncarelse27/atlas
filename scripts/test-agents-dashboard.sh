#!/bin/bash
# 🧪 Comprehensive Test Script for Agents Dashboard Backend
# Tests all endpoints: notifications, business-notes, business-chat

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

API_URL="${API_URL:-https://localhost:8000}"
JWT="${SUPABASE_JWT:-}"

# Test result counters
PASSED=0
FAILED=0
SKIPPED=0

log() {
  echo -e "${1}"
}

logSection() {
  echo ""
  log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  log "${CYAN}${1}${NC}"
  log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

logSuccess() {
  log "${GREEN}✅ ${1}${NC}"
  ((PASSED++))
}

logError() {
  log "${RED}❌ ${1}${NC}"
  ((FAILED++))
}

logWarning() {
  log "${YELLOW}⚠️  ${1}${NC}"
  ((SKIPPED++))
}

logInfo() {
  log "${BLUE}ℹ️  ${1}${NC}"
}

# Check if backend is running
checkBackend() {
  logSection "Backend Health Check"
  
  if curl -s -f "$API_URL/healthz" > /dev/null 2>&1; then
    logSuccess "Backend is running at $API_URL"
    return 0
  else
    logError "Backend is not running at $API_URL"
    logInfo "Start it with: npm run backend:dev"
    return 1
  fi
}

# Check if JWT is provided
checkJWT() {
  if [ -z "$JWT" ]; then
    logWarning "SUPABASE_JWT not set - authenticated tests will be skipped"
    logInfo ""
    logInfo "To get your JWT token:"
    logInfo "1. Open your Atlas app in browser"
    logInfo "2. Open DevTools Console (F12)"
    logInfo "3. Run: const { data: { session } } = await supabase.auth.getSession();"
    logInfo "4. Copy: session?.access_token"
    logInfo ""
    logInfo "Then run: SUPABASE_JWT=<your_token> $0"
    return 1
  else
    logSuccess "JWT token provided (${JWT:0:20}...)"
    return 0
  fi
}

# Test endpoint helper
testEndpoint() {
  local method=$1
  local endpoint=$2
  local description=$3
  local data=$4
  local expected_status=${5:-200}
  
  logInfo "Testing: $method $endpoint"
  logInfo "Description: $description"
  
  local curl_cmd="curl -s -w \"\n%{http_code}\" -X $method \"$API_URL$endpoint\""
  
  if [ -n "$JWT" ]; then
    curl_cmd="$curl_cmd -H \"Authorization: Bearer $JWT\""
  fi
  
  if [ -n "$data" ]; then
    curl_cmd="$curl_cmd -H \"Content-Type: application/json\" -d '$data'"
  fi
  
  local response=$(eval $curl_cmd)
  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "$expected_status" ]; then
    logSuccess "HTTP $http_code (expected $expected_status)"
    if [ -n "$body" ] && [ "$body" != "null" ]; then
      if command -v jq &> /dev/null; then
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
      else
        echo "$body"
      fi
    fi
    return 0
  else
    logError "HTTP $http_code (expected $expected_status)"
    echo "$body"
    return 1
  fi
}

# Main test suite
main() {
  logSection "🧪 Agents Dashboard Backend Test Suite"
  logInfo "API URL: $API_URL"
  logInfo "Timestamp: $(date)"
  echo ""
  
  # Check backend
  if ! checkBackend; then
    logError "Cannot proceed without backend running"
    exit 1
  fi
  
  # Check JWT
  local has_jwt=false
  if checkJWT; then
    has_jwt=true
  fi
  
  echo ""
  
  # Test 1: GET /api/notifications (requires auth)
  logSection "Test 1: GET /api/notifications"
  if [ "$has_jwt" = true ]; then
    if testEndpoint "GET" "/api/notifications" "Fetch user notifications" "" "200"; then
      logInfo "Endpoint working correctly"
    fi
  else
    # Test without auth (should fail)
    if testEndpoint "GET" "/api/notifications" "Should require authentication" "" "401"; then
      logSuccess "Authentication check working (401 as expected)"
    fi
  fi
  
  # Test 2: POST /api/business-notes (requires auth)
  logSection "Test 2: POST /api/business-notes"
  if [ "$has_jwt" = true ]; then
    local test_content="Test note created at $(date +%Y-%m-%d\ %H:%M:%S)"
    local note_data="{\"content\": \"$test_content\"}"
    
    if testEndpoint "POST" "/api/business-notes" "Create business note" "$note_data" "200"; then
      logInfo "Note created successfully"
      # Extract note ID for later tests
      NOTE_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
      if [ -n "$NOTE_ID" ]; then
        logInfo "Note ID: $NOTE_ID"
      fi
    fi
  else
    if testEndpoint "POST" "/api/business-notes" "Should require authentication" "{\"content\":\"test\"}" "401"; then
      logSuccess "Authentication check working (401 as expected)"
    fi
  fi
  
  # Test 3: GET /api/business-notes (requires auth)
  logSection "Test 3: GET /api/business-notes"
  if [ "$has_jwt" = true ]; then
    if testEndpoint "GET" "/api/business-notes" "Fetch all business notes" "" "200"; then
      logInfo "Notes retrieved successfully"
    fi
  else
    if testEndpoint "GET" "/api/business-notes" "Should require authentication" "" "401"; then
      logSuccess "Authentication check working (401 as expected)"
    fi
  fi
  
  # Test 4: POST /api/business-chat (requires auth + Anthropic API)
  logSection "Test 4: POST /api/business-chat"
  if [ "$has_jwt" = true ]; then
    local chat_content="Test memory: I prefer morning meetings and coffee. Created at $(date)"
    local chat_data="{\"content\": \"$chat_content\"}"
    
    if testEndpoint "POST" "/api/business-chat" "Memory-aware chat with LLM" "$chat_data" "200"; then
      logInfo "Business chat working - LLM response generated"
    else
      # Check if it's an Anthropic API error
      if echo "$body" | grep -q "ANTHROPIC_API_KEY\|anthropic\|claude"; then
        logWarning "LLM endpoint exists but Anthropic API may not be configured"
      fi
    fi
  else
    if testEndpoint "POST" "/api/business-chat" "Should require authentication" "{\"content\":\"test\"}" "401"; then
      logSuccess "Authentication check working (401 as expected)"
    fi
  fi
  
  # Test 5: POST /api/notifications/mark-read (requires auth + notification ID)
  logSection "Test 5: POST /api/notifications/mark-read"
  if [ "$has_jwt" = true ]; then
    # First, try to get a notification ID
    local notifications_response=$(curl -s -X GET "$API_URL/api/notifications" \
      -H "Authorization: Bearer $JWT" 2>/dev/null || echo "")
    
    if [ -n "$notifications_response" ]; then
      # Try to extract first notification ID
      local notif_id=$(echo "$notifications_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
      
      if [ -n "$notif_id" ] && [ "$notif_id" != "null" ]; then
        local mark_read_data="{\"notificationId\": \"$notif_id\"}"
        if testEndpoint "POST" "/api/notifications/mark-read" "Mark notification as read" "$mark_read_data" "200"; then
          logInfo "Notification marked as read"
        fi
      else
        logWarning "No notifications found to test mark-read endpoint"
        logInfo "Creating a test notification would require email agent or manual DB insert"
      fi
    fi
  else
    if testEndpoint "POST" "/api/notifications/mark-read" "Should require authentication" "{\"notificationId\":\"test\"}" "401"; then
      logSuccess "Authentication check working (401 as expected)"
    fi
  fi
  
  # Summary
  logSection "Test Summary"
  logInfo "Total Tests: $((PASSED + FAILED + SKIPPED))"
  logSuccess "Passed: $PASSED"
  if [ $FAILED -gt 0 ]; then
    logError "Failed: $FAILED"
  fi
  if [ $SKIPPED -gt 0 ]; then
    logWarning "Skipped: $SKIPPED"
  fi
  
  echo ""
  if [ $FAILED -eq 0 ]; then
    logSuccess "🎉 All tests passed!"
    exit 0
  else
    logError "❌ Some tests failed"
    exit 1
  fi
}

# Run main
main

