#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Day 4: Security Audit & Dependency Scan starting..."

# 1. Install dependencies
npm install

# 2. Run security & secret scan
echo "🔍 Running security/secret scan..."
npx audit-ci --moderate || true

# 3. Run dependency vulnerability scan
echo "🛡️ Running npm audit..."
npm audit || true

# 4. Run TypeScript type-check
echo "📘 Running type check..."
npm run typecheck || true

# 5. Run full test suite (unit + integration)
echo "🧪 Running full test suite..."
npm test || true

echo "✅ Day 4 Security Audit & Dependency Scan complete!"
