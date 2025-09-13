#!/usr/bin/env bash
set -euo pipefail

echo "🌐 Atlas AI v1.0.0 Playwright E2E Validation (NON-BLOCKING)"
echo "============================================================"
echo "📝 E2E MODE: Cross-browser + mobile UX checks"
echo "🎯 GOAL: Upload results for review, never block production deployment"
echo "⚠️ STATUS: NON-BLOCKING - failures do not prevent deployment"
echo ""

# Ensure Playwright browsers are installed
echo "📋 Installing Playwright browsers..."
if npx playwright install --with-deps; then
    echo "✅ Playwright browsers installed successfully"
else
    echo "⚠️ Playwright browser installation failed"
    echo "⚠️ Skipping E2E tests (non-blocking)"
    exit 0
fi
echo ""

# Run comprehensive E2E tests
echo "📋 Running Playwright Cross-Browser + Mobile Suite"
echo "🔍 Testing: Chrome, Safari, Firefox, Mobile Chrome, Mobile Safari"
echo ""

# Create results directory
mkdir -p playwright-report

# Run tests with HTML reporter for better artifact generation
if npx playwright test --reporter=html,list; then
    echo "✅ Playwright E2E tests passed"
    echo "📊 Test results saved to playwright-report/"
else
    echo "⚠️ Playwright E2E tests encountered issues"
    echo "⚠️ This is NON-BLOCKING and does not prevent production deployment"
    echo "📊 Test results saved to playwright-report/ for review"
fi
echo ""

# Generate test summary
echo "📊 E2E Test Summary"
echo "==================="
if [ -f "playwright-report/index.html" ]; then
    echo "✅ HTML report generated: playwright-report/index.html"
    echo "📋 Report contains:"
    echo "   - Cross-browser compatibility results"
    echo "   - Mobile responsiveness validation"
    echo "   - Chat functionality smoke tests"
    echo "   - Authentication flow validation"
else
    echo "⚠️ HTML report not generated"
fi
echo ""

# Upload artifacts (this will be handled by GitHub Actions)
echo "📤 Artifact Upload"
echo "=================="
echo "📋 The following artifacts will be uploaded for review:"
echo "   - playwright-report/ (HTML test results)"
echo "   - test-results/ (screenshots, videos, traces)"
echo "   - E2E test logs and diagnostics"
echo ""

echo "⚠️ E2E VALIDATION COMPLETE (NON-BLOCKING)"
echo "=========================================="
echo "📝 E2E tests completed (success or failure)"
echo "🚀 Production deployment will proceed regardless of E2E results"
echo "📊 Review E2E artifacts for UX improvements and cross-browser issues"
echo "🔄 E2E failures should be addressed in future sprints"
echo ""
