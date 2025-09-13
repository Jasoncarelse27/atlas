#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Atlas AI v1.0.0 Staging Validation"
echo "======================================"

success() { echo "✅ SUCCESS: $1"; }
fail() { echo "❌ FAILED: $1"; exit 1; }
warn() { echo "⚠️ WARNING: $1"; }

# =======================================
# Environment Verification
# =======================================
echo "📋 Environment Verification"
node -v && success "Node.js version"
npm -v && success "npm version"
git status --short || true
branch=$(git rev-parse --abbrev-ref HEAD)
success "On branch: $branch"

# =======================================
# CLI Tools Verification
# =======================================
echo; echo "📋 CLI Tools Verification"
npx playwright --version && success "Playwright installed" || fail "Playwright missing"
vercel --version && success "Vercel CLI installed" || warn "Vercel CLI not found"
sentry-cli --version && success "Sentry CLI installed" || warn "Sentry CLI not found"
railway --version && success "Railway CLI installed" || warn "Railway CLI not found"

# =======================================
# Code Quality Verification
# =======================================
echo; echo "📋 Code Quality Verification"
npm run typecheck && success "TypeScript compilation successful" || fail "TypeScript compilation failed"
npm run lint && success "Linting passed" || fail "Linting failed"
npm test && success "Unit tests passed" || fail "Unit tests failed"

# =======================================
# Playwright End-to-End Tests
# =======================================
echo; echo "📋 Playwright End-to-End Tests"
npx playwright install --with-deps
npm run test:e2e && success "Playwright E2E tests passed" || fail "Playwright E2E tests failed"

# =======================================
# Summary
# =======================================
echo; echo "📋 Staging Validation Summary"
echo "======================================"
echo "✅ TypeScript: Passed"
echo "✅ Linting: Passed"
echo "✅ Unit Tests: Passed"
echo "✅ E2E Tests: Passed"
echo "======================================"
echo "🎉 All staging validation checks passed! Atlas AI is ready for production."
