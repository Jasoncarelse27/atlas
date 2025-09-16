#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Running lightweight pre-push checks..."

npm run lint
npm run typecheck

echo "✅ Pre-push checks passed!"
