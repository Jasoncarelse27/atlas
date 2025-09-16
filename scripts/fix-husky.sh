#!/usr/bin/env bash
set -euo pipefail

FILE=".husky/pre-push"

if [ -f "$FILE" ]; then
  # Remove deprecated lines if they exist
  grep -vE 'husky.sh' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
fi
