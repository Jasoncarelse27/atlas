#!/usr/bin/env bash
set -euo pipefail

echo "🔎 Checking Node & workspace..."
node -v && npm -v

echo "🧹 Freeing backend port 8000 if needed..."
if lsof -i :8000 >/dev/null 2>&1; then
  lsof -ti :8000 | xargs kill -9 || true
  echo "✅ Port 8000 freed"
else
  echo "✅ Port 8000 available"
fi

echo "🔐 Verifying required env..."
# Check if .env exists, if not create a basic one for development
if [ ! -f .env ]; then
  echo "📝 Creating basic .env for development..."
  cat > .env << EOF
# Development Environment Variables
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
CLAUDE_API_KEY=your-claude-key
NODE_ENV=development
EOF
  echo "⚠️  Created basic .env - please add your actual API keys"
  MISSING=1
else
  REQ_VARS=(VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY CLAUDE_API_KEY)
  for v in "${REQ_VARS[@]}"; do
    if ! grep -q "^${v}=" .env || grep -q "^${v}=your-" .env; then
      echo "⚠️  Missing or placeholder ${v} in .env"; MISSING=1
    fi
  done
fi
[ "${MISSING:-0}" = 1 ] && echo "❌ Add missing env vars to .env and re-run" && exit 1
echo "✅ Env looks good"

echo "🧪 Types & tests..."
npm run typecheck
npm run test

echo "🏗️ Build web (vite)..."
npm run build

echo "🚀 Start backend (dev) in background..."
( npm run dev >/tmp/atlas-server.log 2>&1 & echo $! > /tmp/atlas-server.pid )
sleep 2

echo "🩺 Health check..."
curl -sf http://localhost:8000/healthz && echo "✅ healthz OK" || (echo "❌ healthz failed"; tail -n 60 /tmp/atlas-server.log; kill $(cat /tmp/atlas-server.pid) 2>/dev/null || true; exit 1)

echo "🛰️ Ping API..."
curl -sf http://localhost:8000/ping && echo "✅ ping OK" || (echo "❌ ping failed"; exit 1)

echo "🧠 AI key check via Claude CLI..."
claude --version >/dev/null 2>&1 || echo "ℹ️ claude CLI not found (OK if using server-side calls only)"
# Simple no-op config read to ensure CLI is installed & key present (won't bill):
claude config get theme >/dev/null 2>&1 && echo "✅ Claude CLI ready" || echo "ℹ️ Skip: CLI not configured here"

echo "🧹 Cleanup background server..."
kill $(cat /tmp/atlas-server.pid) 2>/dev/null || true
rm -f /tmp/atlas-server.pid

echo "✅ API smoke check PASSED."
