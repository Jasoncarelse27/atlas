#!/usr/bin/env bash
set -euo pipefail

echo "🌐 Atlas AI v1.0.0 Playwright E2E Validation"
echo "======================================="

# Ensure Playwright browsers are installed
npx playwright install --with-deps

# Run all E2E tests
echo "📋 Running Playwright Cross-Browser Suite"
npx playwright test --reporter=list

echo "⚠️ NOTE: E2E failures should be reviewed but do not block hotfix deployments."
echo "✅ Playwright validation complete."
