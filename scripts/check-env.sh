#!/bin/bash
# 🚫 Prevent committing .env files or secrets

echo "🔍 Running pre-commit secret scan..."

# Block .env files
if git diff --cached --name-only | grep -E '\.env($|\.|/)' ; then
  echo "❌ ERROR: Do not commit .env or secret files!"
  echo "👉 Add them to .gitignore and use supabase.env.example for placeholders."
  exit 1
fi

# Block known secret patterns in staged changes
if git diff --cached | grep -E '(sk_live_|pdl_[0-9a-zA-Z]{20,}|SUPABASE_[A-Z0-9_]+|api[_-]?key\s*=\s*[0-9a-zA-Z_-]{20,})'; then
  echo "❌ ERROR: Possible secret/API key detected in commit!"
  echo "👉 Remove the secret and store it in GitHub Secrets or .env (ignored)."
  exit 1
fi

echo "✅ No secrets detected in staged changes"
exit 0
