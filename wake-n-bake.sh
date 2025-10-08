#!/bin/bash
echo "🌅 Wake-n-Bake-Restore: Atlas secure startup sequence initiated..."

# === 1️⃣ SAFELY RESTORE ENVIRONMENT ===
if [ ! -f ".env" ]; then
  if [ -f ".env.production" ]; then
    echo "🧩 Restoring .env from .env.production..."
    cp .env.production .env
  else
    echo "⚙️  No .env or .env.production found – creating empty .env"
    echo "# Local only – never commit keys" > .env
  fi
else
  echo "✅ .env already exists – keeping current keys."
fi

# === 2️⃣ VERIFY KEYS WITHOUT EXPOSING THEM ===
echo ""
echo "🔐 Checking API keys..."
CLAUDE_KEY=$(grep -s "ANTHROPIC_API_KEY" .env)
OPENAI_KEY=$(grep -s "OPENAI_API_KEY" .env)
SUPABASE_KEY=$(grep -s "SUPABASE_ANON_KEY" .env)

[[ -n "$CLAUDE_KEY" ]] && echo "🧠 Claude/Anthropic ...... ✅ Present" || echo "❌ Claude/Anthropic ...... Missing"
[[ -n "$OPENAI_KEY" ]] && echo "🎙️  OpenAI (Whisper/TTS) .. ✅ Present" || echo "⚠️  OpenAI (Whisper/TTS) .. Missing"
[[ -n "$SUPABASE_KEY" ]] && echo "🗄️  Supabase .............. ✅ Present" || echo "⚠️  Supabase .............. Missing"

# === 3️⃣ STRUCTURE + SECURITY CHECK ===
echo ""
if [ -d "src" ] && [ -d "backend" ]; then
  echo "🧱 Folder structure ........ ✅ src + backend present"
else
  echo "⚠️  Missing core folders, verify repo root"
fi

# Harden .gitignore (never touch .env again)
grep -q ".env" .gitignore || cat <<'EOF' >> .gitignore

# === SECURITY ===
.env
.env.*
.cert/
*.pem
*.key
EOF

# === 4️⃣ CLEAN OLD PROCESSES & START SERVERS ===
echo ""
echo "🧹 Cleaning old Node/Vite processes..."
pkill -f "node|vite" 2>/dev/null
sleep 2

echo "🚀 Launching backend + frontend..."
if [ -d "backend" ]; then
  (cd backend && nohup node server.mjs > ../backend.log 2>&1 &)
  echo "📜 Backend logs: tail -f backend.log"
else
  echo "⚠️  No backend folder found."
fi

if [ -f "package.json" ]; then
  nohup npm run dev > frontend.log 2>&1 &
  echo "📜 Frontend logs: tail -f frontend.log"
else
  echo "⚠️  No package.json found (frontend not started)."
fi

# === 5️⃣ DISPLAY STATUS ===
sleep 3
echo ""
echo "✅ Wake-n-Bake-Restore complete!"
echo "🌍 Access Atlas at:"
echo " - Desktop: http://localhost:5174"
echo " - Mobile:  http://192.168.0.229:5174"
echo ""
echo "💤 All systems go. Safe, secure, and future-proof."
