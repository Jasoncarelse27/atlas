#!/usr/bin/env bash
set -euo pipefail

# --- SETTINGS (edit if needed) ---
BACKEND_DIR="${BACKEND_DIR:-$HOME/atlas}"
PORT="${PORT:-8000}"
LMSTUDIO_URL="${LMSTUDIO_URL:-http://127.0.0.1:1234}"
LMSTUDIO_MODEL="${LMSTUDIO_MODEL:-qwen2.5-coder:7b}"  # any local model you start in LM Studio
VOICE_DIR="$HOME/piper/voices/amy"
VOICE_ONNX="$VOICE_DIR/en_US-amy-medium.onnx"
VOICE_JSON="$VOICE_DIR/en_US-amy-medium.onnx.json"

echo "🔧 Ensuring Piper + voice…"
command -v piper >/dev/null 2>&1 || brew install piper
mkdir -p "$VOICE_DIR"
[ -f "$VOICE_ONNX" ] || curl -L -o "$VOICE_ONNX" https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-amy-medium.onnx
[ -f "$VOICE_JSON" ] || curl -L -o "$VOICE_JSON" https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-amy-medium.onnx.json

echo "📝 Writing env file…"
cat > "$BACKEND_DIR/.env" <<EOF
LMSTUDIO_URL=${LMSTUDIO_URL}
LMSTUDIO_MODEL=${LMSTUDIO_MODEL}
WHISPER_MODEL=base
WHISPER_COMPUTE_TYPE=auto
PIPER_BIN=$(command -v piper)
PIPER_VOICE=${VOICE_ONNX}
PORT=${PORT}
EOF

echo "🔁 Restarting backend…"
cd "$BACKEND_DIR"
source "$HOME/venvs/atlas/bin/activate"
pkill -f "uvicorn server:app" >/dev/null 2>&1 || true
nohup env $(cat .env | xargs) uvicorn server:app --reload --port "$PORT" > "$HOME/nova-backend.log" 2>&1 &

sleep 1
echo "🩺 Health:"
curl -s "http://127.0.0.1:${PORT}/health" || true
echo
echo "➡️  If LM Studio is not connected: open LM Studio, load '${LMSTUDIO_MODEL}', click 'Start Server'."
echo "   (Default address should be ${LMSTUDIO_URL})"

