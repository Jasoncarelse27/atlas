#!/usr/bin/env bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to atlas-mobile directory
cd "$REPO_ROOT/atlas-mobile"

# Clear caches
rm -rf .expo .cache node_modules/.cache || true

# Start Expo
npx expo start --clear
