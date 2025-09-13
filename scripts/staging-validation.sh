#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Atlas AI v1.0.0 Staging Validation (Core Checks)"
echo "======================================="

# Environment checks
echo "📋 Environment Verification"
node -v
npm -v
git status

# TypeScript
echo "📋 TypeScript Compilation"
npm run typecheck

# Linting
echo "📋 ESLint Linting"
npm run lint

# Unit Tests
echo "📋 Unit Test Execution"
npm test -- --run --passWithNoTests

# Build
echo "📋 Production Build"
npm run build

echo "✅ Core validation passed. Safe to deploy baseline to production."