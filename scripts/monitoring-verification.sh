#!/usr/bin/env bash
set -euo pipefail

# Atlas AI Monitoring Verification Script
# Sends test events to verify all monitoring systems are working

echo "📊 Atlas AI Monitoring Verification"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERSION="v1.0.0"
SUCCESS_COUNT=0
TOTAL_TESTS=0

# Helper functions
log_test() {
    echo -e "${BLUE}🔍 Testing: $1${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

log_success() {
    echo -e "${GREEN}✅ SUCCESS: $1${NC}"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
}

log_failure() {
    echo -e "${RED}❌ FAILED: $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ WARNING: $1${NC}"
}

# 1. Sentry Error Tracking Verification
echo ""
echo "🚨 Sentry Error Tracking Verification"
echo "--------------------------------------"

log_test "Sentry CLI availability"
if command -v sentry-cli &> /dev/null; then
    log_success "Sentry CLI available ($(sentry-cli --version))"
else
    log_failure "Sentry CLI not available"
    exit 1
fi

log_test "Sentry configuration"
if [ -f ".sentryclirc" ]; then
    log_success "Sentry configuration file found"
else
    log_failure "Sentry configuration file missing"
fi

log_test "Sentry release creation"
if sentry-cli releases new $VERSION >/dev/null 2>&1; then
    log_success "Sentry release $VERSION created"
else
    log_warning "Sentry release creation failed (may already exist)"
fi

log_test "Sentry test event"
if sentry-cli send-event --message "Atlas AI $VERSION Monitoring Test Event" --release $VERSION --level info >/dev/null 2>&1; then
    log_success "Sentry test event sent successfully"
else
    log_warning "Sentry test event failed (may need auth token)"
fi

log_test "Sentry error event"
if sentry-cli send-event --message "Atlas AI $VERSION Test Error" --release $VERSION --level error >/dev/null 2>&1; then
    log_success "Sentry error event sent successfully"
else
    log_warning "Sentry error event failed (may need auth token)"
fi

# 2. Supabase Database Monitoring
echo ""
echo "🗄️ Supabase Database Monitoring"
echo "--------------------------------"

log_test "Supabase CLI availability"
if command -v supabase &> /dev/null; then
    log_success "Supabase CLI available"
else
    log_failure "Supabase CLI not available"
fi

log_test "Supabase project status"
if supabase status >/dev/null 2>&1; then
    log_success "Supabase project is active"
else
    log_warning "Supabase project not connected (may need configuration)"
fi

log_test "Supabase Edge Functions"
if [ -d "supabase/functions" ]; then
    FUNCTIONS_COUNT=$(find supabase/functions -maxdepth 1 -type d | wc -l)
    log_success "Supabase Edge Functions found ($((FUNCTIONS_COUNT-1)) functions)"
else
    log_failure "Supabase Edge Functions directory not found"
fi

log_test "Supabase logs access"
if supabase functions logs --limit 5 >/dev/null 2>&1; then
    log_success "Supabase logs accessible"
else
    log_warning "Supabase logs not accessible (may need authentication)"
fi

# 3. Railway Backend Monitoring
echo ""
echo "🚂 Railway Backend Monitoring"
echo "------------------------------"

log_test "Railway CLI availability"
if command -v railway &> /dev/null; then
    log_success "Railway CLI available ($(railway --version))"
else
    log_failure "Railway CLI not available"
fi

log_test "Railway authentication"
if railway whoami >/dev/null 2>&1; then
    log_success "Railway authentication successful"
else
    log_warning "Railway not authenticated (run: railway login)"
fi

log_test "Railway project connection"
if railway status >/dev/null 2>&1; then
    log_success "Railway project connected"
else
    log_warning "Railway project not connected (may need configuration)"
fi

log_test "Railway service health"
if railway logs --lines 5 >/dev/null 2>&1; then
    log_success "Railway service logs accessible"
else
    log_warning "Railway service logs not accessible (service may not be deployed)"
fi

# 4. Vercel Frontend Monitoring
echo ""
echo "▲ Vercel Frontend Monitoring"
echo "-----------------------------"

log_test "Vercel CLI availability"
if command -v vercel &> /dev/null; then
    log_success "Vercel CLI available ($(vercel --version))"
else
    log_failure "Vercel CLI not available"
fi

log_test "Vercel authentication"
if vercel whoami >/dev/null 2>&1; then
    log_success "Vercel authentication successful"
else
    log_warning "Vercel not authenticated (run: vercel login)"
fi

log_test "Vercel project configuration"
if [ -f "vercel.json" ]; then
    log_success "Vercel configuration file found"
else
    log_warning "Vercel configuration file not found"
fi

log_test "Vercel deployment status"
if vercel ls >/dev/null 2>&1; then
    log_success "Vercel deployments accessible"
else
    log_warning "Vercel deployments not accessible (may need authentication)"
fi

# 5. Application Health Checks
echo ""
echo "🏥 Application Health Checks"
echo "-----------------------------"

log_test "Backend server file"
if [ -f "backend/server.mjs" ]; then
    log_success "Backend server file found"
else
    log_failure "Backend server file not found"
fi

log_test "Health check endpoints"
if grep -q "/health" backend/server.mjs 2>/dev/null; then
    log_success "Health check endpoints configured"
else
    log_warning "Health check endpoints not found"
fi

log_test "Error boundary component"
if [ -f "src/lib/errorBoundary.tsx" ]; then
    log_success "Error boundary component found"
else
    log_warning "Error boundary component not found"
fi

log_test "Centralized logging"
if [ -f "src/utils/logger.ts" ]; then
    log_success "Centralized logger found"
else
    log_warning "Centralized logger not found"
fi

# 6. Performance Monitoring
echo ""
echo "⚡ Performance Monitoring"
echo "--------------------------"

log_test "Bundle analysis capability"
if [ -f "package.json" ] && grep -q "analyze" package.json; then
    log_success "Bundle analyzer script available"
else
    log_warning "Bundle analyzer not configured"
fi

log_test "Performance monitoring config"
if [ -f "src/config/monitoring.ts" ]; then
    log_success "Performance monitoring configuration found"
else
    log_warning "Performance monitoring configuration not found"
fi

log_test "Build process"
if npm run build >/dev/null 2>&1; then
    log_success "Production build successful"
else
    log_failure "Production build failed"
fi

# 7. Integration Testing
echo ""
echo "🔗 Integration Testing"
echo "----------------------"

log_test "TypeScript compilation"
if npm run typecheck >/dev/null 2>&1; then
    log_success "TypeScript compilation successful"
else
    log_failure "TypeScript compilation failed"
fi

log_test "Test suite execution"
if npm run test >/dev/null 2>&1; then
    log_success "Test suite execution successful"
else
    log_warning "Some tests may be failing"
fi

log_test "Linting compliance"
if npm run lint >/dev/null 2>&1; then
    log_success "Linting passed"
else
    log_warning "Linting warnings present (non-blocking)"
fi

# Final Results
echo ""
echo "📊 Monitoring Verification Results"
echo "=================================="
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Successful: ${SUCCESS_COUNT}${NC}"
echo -e "${RED}Failed: $((TOTAL_TESTS - SUCCESS_COUNT))${NC}"

SUCCESS_RATE=$((SUCCESS_COUNT * 100 / TOTAL_TESTS))
echo -e "Success Rate: ${SUCCESS_RATE}%"

echo ""
echo "🔗 Monitoring Dashboard Links:"
echo "==============================="
echo "• Sentry: https://sentry.io/organizations/atlas-ai/projects/atlas-ai/"
echo "• Railway: https://railway.app/dashboard"
echo "• Vercel: https://vercel.com/dashboard"
echo "• Supabase: https://supabase.com/dashboard"

echo ""
if [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${GREEN}🎉 Monitoring verification successful! Atlas AI v1.0.0 monitoring is operational.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ Monitoring verification completed with warnings. Review failed tests above.${NC}"
    exit 1
fi
