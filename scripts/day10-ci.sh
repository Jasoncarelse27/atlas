#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Day 10: Starting CI/CD Pipeline Polish..."

# 1. Update GitHub Actions workflow for CI/CD
cat > .github/workflows/ci.yml <<'YML'
name: CI/CD Pipeline

on:
  push:
    branches: [ "main", "refactor/conversation-view-split" ]
  pull_request:
    branches: [ "main", "refactor/conversation-view-split" ]

jobs:
  build-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Lint check
        run: npm run lint --if-present

      - name: TypeScript check
        run: npm run typecheck --if-present

      - name: Run unit + integration tests
        run: npm test --if-present

      - name: Security scan
        run: npx audit-ci --moderate
YML

# 2. Run local validation
echo "⚡ Running lint + typecheck + tests locally before commit..."
npm run lint || true
npm run typecheck || true
npm test || true

# 3. Save logs
echo "📊 Saving logs to scripts/day10-ci.log..."
{
  echo "==== LINT RESULTS ===="
  npm run lint || true
  echo "==== TYPECHECK RESULTS ===="
  npm run typecheck || true
  echo "==== TEST RESULTS ===="
  npm test || true
} > scripts/day10-ci.log

echo "✅ Day 10: CI/CD Pipeline Polish complete!"
