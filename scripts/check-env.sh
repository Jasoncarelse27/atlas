#!/bin/bash
# 🚫 Prevent committing .env files or secrets

echo "🔍 Running pre-commit secret scan..."

# Block .env files (but allow .env.example files)
if git diff --cached --name-only | grep -E '\.env$|\.env\.(local|production|development|test)$' ; then
  echo "❌ ERROR: Do not commit .env or secret files!"
  echo "👉 Add them to .gitignore and use .env.example files for placeholders."
  exit 1
fi

# Block known secret patterns in staged changes (but allow example files)
if git diff --cached --name-only | grep -v -E '\.(example|md)$' | xargs git diff --cached | grep -E '(sk_live_|pdl_[0-9a-zA-Z]{20,}|api[_-]?key\s*=\s*[0-9a-zA-Z_-]{20,})'; then
  echo "❌ ERROR: Possible secret/API key detected in commit!"
  echo "👉 Remove the secret and store it in GitHub Secrets or .env (ignored)."
  exit 1
fi

# Block SUPABASE_ patterns only in non-example files
if git diff --cached --name-only | grep -v -E '\.(example|md)$' | xargs git diff --cached | grep -E 'SUPABASE_[A-Z0-9_]+'; then
  echo "❌ ERROR: SUPABASE secret detected in commit!"
  echo "👉 Remove the secret and store it in GitHub Secrets or .env (ignored)."
  exit 1
fi

echo "✅ No secrets detected in staged changes"
exit 0
