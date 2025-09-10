#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Scanning repo for false-positive secrets (keys/tokens)..."

# Patterns GitHub Actions often flags
PATTERNS=(
  "sk-[a-zA-Z0-9]{20,}"      # OpenAI-like keys
  "ghp_[A-Za-z0-9]{36,}"     # GitHub tokens
  "eyJ[a-zA-Z0-9_-]{10,}"    # JWT tokens
  "AIza[0-9A-Za-z-_]{35}"    # Google keys
)

# Loop through patterns and clean files
for pattern in "${PATTERNS[@]}"; do
  echo "⚡ Checking pattern: $pattern"
  
  # Find files with the pattern (only tracked files)
  files_with_pattern=$(git grep -Il "$pattern" 2>/dev/null | grep -vE "(\.env|node_modules|package-lock\.json)" || true)
  
  if [ -n "$files_with_pattern" ]; then
    echo "$files_with_pattern" | while read -r file; do
      echo "   → Cleaning $file"
      sed -i.bak -E "s/$pattern/PLACEHOLDER_SECRET/g" "$file" && rm -f "$file.bak"
    done
  else
    echo "   → No matches found for pattern: $pattern"
  fi
done

echo "✅ Cleanup complete. Staging changes..."
git add .

# Only commit if there are changes
if ! git diff --cached --quiet; then
  git commit -m "chore(security): cleanup false positive secrets with placeholders"
  echo "⬆️ Pushing to GitHub..."
  git push origin refactor/conversation-view-split
else
  echo "✨ No false positives found. Nothing to commit."
fi

echo "🎉 Done! Repo is clean and ready for GitHub push protection."