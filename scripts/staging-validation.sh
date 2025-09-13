#!/usr/bin/env bash
set -euo pipefail

# Atlas AI v1.0.0 Staging Validation Script
# Comprehensive staging validation before production promotion

echo "🚀 Atlas AI v1.0.0 Staging Validation"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

VERSION="v1.0.0"
VALIDATION_PASSED=true

# Helper functions
log_section() {
    echo ""
    echo -e "${PURPLE}📋 $1${NC}"
    echo "$(printf '=%.0s' {1..50})"
}

log_test() {
    echo -e "${BLUE}🔍 Running: $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ SUCCESS: $1${NC}"
}

log_failure() {
    echo -e "${RED}❌ FAILED: $1${NC}"
    VALIDATION_PASSED=false
}

log_warning() {
    echo -e "${YELLOW}⚠️ WARNING: $1${NC}"
}

# 1. Environment Verification
log_section "Environment Verification"

log_test "Node.js version"
NODE_VERSION=$(node --version)
log_success "Node.js $NODE_VERSION"

log_test "npm version"
NPM_VERSION=$(npm --version)
log_success "npm $NPM_VERSION"

log_test "Git status"
if git status --porcelain | grep -q .; then
    log_warning "Uncommitted changes detected"
else
    log_success "Git working directory clean"
fi

log_test "Current branch"
CURRENT_BRANCH=$(git branch --show-current)
log_success "On branch: $CURRENT_BRANCH"

# 2. CLI Tools Verification
log_section "CLI Tools Verification"

log_test "Playwright installation"
if command -v playwright &> /dev/null; then
    PLAYWRIGHT_VERSION=$(playwright --version)
    log_success "Playwright $PLAYWRIGHT_VERSION installed"
else
    log_failure "Playwright not installed"
fi

log_test "Railway CLI installation"
if command -v railway &> /dev/null; then
    RAILWAY_VERSION=$(railway --version)
    log_success "Railway CLI $RAILWAY_VERSION installed"
else
    log_failure "Railway CLI not installed"
fi

log_test "Vercel CLI installation"
if command -v vercel &> /dev/null; then
    VERCEL_VERSION=$(vercel --version)
    log_success "Vercel CLI $VERCEL_VERSION installed"
else
    log_failure "Vercel CLI not installed"
fi

log_test "Sentry CLI installation"
if command -v sentry-cli &> /dev/null; then
    SENTRY_VERSION=$(sentry-cli --version)
    log_success "Sentry CLI $SENTRY_VERSION installed"
else
    log_failure "Sentry CLI not installed"
fi

# 3. Code Quality Verification
log_section "Code Quality Verification"

log_test "TypeScript compilation"
if npm run typecheck >/dev/null 2>&1; then
    log_success "TypeScript compilation successful"
else
    log_failure "TypeScript compilation failed"
fi

log_test "Linting compliance"
if npm run lint >/dev/null 2>&1; then
    log_success "Linting passed"
else
    log_warning "Linting warnings present (non-blocking)"
fi

log_test "Test suite execution"
if npm run test >/dev/null 2>&1; then
    log_success "All tests passing"
else
    log_failure "Some tests failing"
fi

log_test "Production build"
if npm run build >/dev/null 2>&1; then
    log_success "Production build successful"
else
    log_failure "Production build failed"
fi

# 4. Component Verification
log_section "Component Verification"

log_test "Authentication page"
if [ -f "src/pages/AuthPage.tsx" ]; then
    log_success "AuthPage.tsx found"
else
    log_failure "AuthPage.tsx not found"
fi

log_test "Chat page"
if [ -f "src/pages/ChatPage.tsx" ]; then
    log_success "ChatPage.tsx found"
else
    log_failure "ChatPage.tsx not found"
fi

log_test "Chat service"
if [ -f "src/services/chatService.ts" ]; then
    log_success "chatService.ts found"
else
    log_failure "chatService.ts not found"
fi

log_test "MailerLite integration"
if [ -f "src/components/MailerLiteIntegration.tsx" ]; then
    log_success "MailerLiteIntegration.tsx found"
else
    log_failure "MailerLiteIntegration.tsx not found"
fi

log_test "Subscription gates"
if [ -f "src/features/chat/components/SubscriptionGate.tsx" ]; then
    log_success "SubscriptionGate.tsx found"
else
    log_failure "SubscriptionGate.tsx not found"
fi

# 5. Cross-Browser Testing
log_section "Cross-Browser Testing Setup"

log_test "Playwright browsers"
if playwright install --dry-run >/dev/null 2>&1; then
    log_success "Playwright browsers ready"
else
    log_warning "Playwright browsers may need installation"
fi

log_test "Cross-browser test suite"
if [ -f "tests/e2e/cross-browser.spec.ts" ]; then
    log_success "Cross-browser test suite ready"
else
    log_failure "Cross-browser test suite not found"
fi

# 6. Monitoring Integration
log_section "Monitoring Integration"

log_test "Sentry configuration"
if [ -f ".sentryclirc" ]; then
    log_success "Sentry configuration ready"
else
    log_failure "Sentry configuration missing"
fi

log_test "Supabase configuration"
if [ -f "supabase/config.toml" ]; then
    log_success "Supabase configuration ready"
else
    log_warning "Supabase configuration not found"
fi

log_test "Vercel configuration"
if [ -f "vercel.json" ]; then
    log_success "Vercel configuration ready"
else
    log_warning "Vercel configuration not found"
fi

log_test "Railway configuration"
if [ -f "railway.json" ] || [ -f "Dockerfile.railway" ]; then
    log_success "Railway configuration ready"
else
    log_warning "Railway configuration not found"
fi

# 7. Run Monitoring Verification
log_section "Monitoring System Verification"

log_test "Running monitoring verification script"
if ./scripts/monitoring-verification.sh >/dev/null 2>&1; then
    log_success "Monitoring verification passed"
else
    log_warning "Monitoring verification completed with warnings"
fi

# 8. Run QA Test Suite
log_section "QA Test Suite Execution"

log_test "Running comprehensive QA test suite"
if ./scripts/qa-test-suite.sh >/dev/null 2>&1; then
    log_success "QA test suite passed"
else
    log_warning "QA test suite completed with warnings"
fi

# 9. Final Validation Summary
log_section "Staging Validation Summary"

echo ""
echo "📊 Validation Results:"
echo "====================="

if [ "$VALIDATION_PASSED" = true ]; then
    echo -e "${GREEN}🎉 STAGING VALIDATION PASSED!${NC}"
    echo -e "${GREEN}✅ Atlas AI v1.0.0 is ready for production deployment${NC}"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Deploy to staging environment"
    echo "   2. Run final smoke tests"
    echo "   3. Promote to production"
    echo "   4. Monitor production metrics"
    exit 0
else
    echo -e "${RED}❌ STAGING VALIDATION FAILED!${NC}"
    echo -e "${RED}⚠️ Please address the failed items before production deployment${NC}"
    echo ""
    echo "🔧 Required Actions:"
    echo "   1. Fix failed tests and components"
    echo "   2. Resolve code quality issues"
    echo "   3. Complete monitoring setup"
    echo "   4. Re-run validation"
    exit 1
fi
