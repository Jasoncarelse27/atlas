#!/usr/bin/env bash
set -euo pipefail

# ╭────────────────────────────────────────────────────────────────╮
# │ CONFIG: change these 2 paths if your layout differs            │
# ╰────────────────────────────────────────────────────────────────╯
BACKEND_DIR="${BACKEND_DIR:-$HOME/atlas}"       # where server.py lives
NOVA_DIR="${NOVA_DIR:-$HOME/nova-app}"          # Electron Nova app folder
PORT="${PORT:-8000}"
LM_URL_DEFAULT="${LM_URL_DEFAULT:-http://127.0.0.1:1234}"
LM_MODEL_DEFAULT="${LM_MODEL_DEFAULT:-qwen2.5-coder:7b}"

# Project-local env file for clean scaling
mkdir -p "$BACKEND_DIR" "$NOVA_DIR"
ENV_FILE="$BACKEND_DIR/.env"

# ── 1) Ensure Piper & voice (offline TTS) ─────────────────────────
if ! command -v piper >/dev/null 2>&1; then
  echo "📦 Installing Piper (offline TTS)…"
  brew install piper
fi

VOICE_DIR="$HOME/piper/voices/amy"
VOICE_ONNX="$VOICE_DIR/en_US-amy-medium.onnx"
VOICE_JSON="$VOICE_DIR/en_US-amy-medium.onnx.json"

if [ ! -f "$VOICE_ONNX" ] || [ ! -f "$VOICE_JSON" ]; then
  echo "🔊 Downloading Piper 'amy' voice (once)…"
  mkdir -p "$VOICE_DIR"
  curl -L -o "$VOICE_ONNX" https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-amy-medium.onnx
  curl -L -o "$VOICE_JSON" https://github.com/rhasspy/piper/releases/download/v0.0.2/en_US-amy-medium.onnx.json
fi

# ── 2) Write .env (single source of truth) ────────────────────────
cat > "$ENV_FILE" <<EOF
# Nova Offline Backend (.env)
LMSTUDIO_URL=${LM_URL_DEFAULT}
LMSTUDIO_MODEL=${LM_MODEL_DEFAULT}

# Whisper STT
WHISPER_MODEL=base
WHISPER_COMPUTE_TYPE=auto

# Piper TTS
PIPER_BIN=$(command -v piper)
PIPER_VOICE=${VOICE_ONNX}

# Backend
PORT=${PORT}
EOF
echo "✅ Wrote $ENV_FILE"

# ── 3) Health checker (reads .env) ────────────────────────────────
cat > "$BACKEND_DIR/health.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a

echo "🔎 Checking LM Studio at \$LMSTUDIO_URL …"
if curl -s "\$LMSTUDIO_URL/v1/models" >/dev/null 2>&1; then echo "✅ LM Studio reachable"; else echo "❌ LM Studio NOT reachable"; fi

echo "🔎 Piper …"
if [ -x "\$PIPER_BIN" ] && [ -f "\$PIPER_VOICE" ]; then echo "✅ Piper ok (\$PIPER_BIN) voice=$(basename "\$PIPER_VOICE")"; else echo "❌ Piper or voice missing"; fi

echo "🔎 Backend /health (if running)…"
curl -s "http://127.0.0.1:\${PORT:-8000}/health" || echo "Backend not up"
echo
SH
chmod +x "$BACKEND_DIR/health.sh"

# ── 4) Bring-up script (backend + optional Nova) ──────────────────
cat > "$BACKEND_DIR/nova_up.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a

echo "🔁 Starting Nova Offline Backend on :${PORT:-8000}…"
pkill -f "uvicorn server:app" >/dev/null 2>&1 || true
(
  cd "$ROOT"
  source "$HOME/venvs/atlas/bin/activate"
  nohup uvicorn server:app --reload --port "${PORT:-8000}" > "$HOME/nova-backend.log" 2>&1 &
)
sleep 1
echo "ℹ️ Logs: $HOME/nova-backend.log"
echo "🌐 Health:"; curl -s "http://127.0.0.1:${PORT:-8000}/health" && echo

# Optionally launch Electron Nova if present
if [ -d "$HOME/nova-app" ]; then
  echo "🚀 Launching Nova (Electron)…"
  (cd "$HOME/nova-app" && npm install --silent && npm run start)
else
  echo "ℹ️ Nova Electron app not found at ~/nova-app (skipping)."
fi
SH
chmod +x "$BACKEND_DIR/nova_up.sh"

# ── 5) VS Code tasks + hotkeys (health, bring-up, clipboard, voice) ─
VSCODE_DIR="$(pwd)/.vscode"
SCRIPTS_DIR="$(pwd)/scripts"
KEYB="$HOME/Library/Application Support/Code/User/keybindings.json"
mkdir -p "$VSCODE_DIR" "$SCRIPTS_DIR"

# Clipboard → chat → /tts (WAV)
cat > "$SCRIPTS_DIR/ask_nova.sh" <<SH
#!/usr/bin/env bash
set -euo pipefail
API="http://127.0.0.1:${PORT}"
PROMPT="\$(pbpaste | sed 's/\"/\\\\\"/g')"
[ -z "\$PROMPT" ] && { echo "Clipboard empty — copy text first."; exit 1; }

RESP="\$(curl -s -X POST "\$API/chat" -F "prompt=\$PROMPT")"
TEXT="\$(python3 - <<'PY' "\$RESP"
import sys,json; data=json.loads(sys.argv[1]); print(data.get("text","").strip())
PY
)"
[ -z "\$TEXT" ] && { echo "No reply from Nova."; exit 1; }
echo "\$TEXT" | tee /tmp/nova_reply.txt

curl -s -X POST "\$API/tts" -F "text=\$TEXT" --output /tmp/nova_reply.wav >/dev/null || true
[ -f /tmp/nova_reply.wav ] && afplay /tmp/nova_reply.wav >/dev/null 2>&1 || true
command -v code >/dev/null 2>&1 && code -r /tmp/nova_reply.txt || true
SH
chmod +x "$SCRIPTS_DIR/ask_nova.sh"

# Voice 5s → /voice-chat (WAV base64) → play + open
cat > "$SCRIPTS_DIR/voice_ask_nova.sh" <<SH
#!/usr/bin/env bash
set -euo pipefail
API="http://127.0.0.1:${PORT}"
TMPWAV="/tmp/nova_voice_input.wav"

if ! command -v sox >/dev/null 2>&1; then
  echo "Installing sox for mic record…"; brew install sox
fi

echo "🎙️ Recording 5s…"
sox -d -c 1 -r 16000 -b 16 "\$TMPWAV" trim 0 5

RESP="\$(curl -s -X POST "\$API/voice-chat" -F "file=@\$TMPWAV")"
echo "\$RESP" > /tmp/nova_voice.json

python3 - <<'PY' "/tmp/nova_voice.json"
import json,base64,pathlib,sys
d=json.load(open(sys.argv[1]))
txt=d.get("text","").strip()
print("Nova:", txt)
pathlib.Path("/tmp/nova_voice_reply.txt").write_text(txt)
if "audio_base64" in d:
    path=pathlib.Path("/tmp/nova_voice_reply.wav")
    path.write_bytes(base64.b64decode(d["audio_base64"]))
PY

[ -f /tmp/nova_voice_reply.wav ] && afplay /tmp/nova_voice_reply.wav >/dev/null 2>&1 || true
command -v code >/dev/null 2>&1 && code -r /tmp/nova_voice_reply.txt || true
SH
chmod +x "$SCRIPTS_DIR/voice_ask_nova.sh"

# tasks.json
cat > "$VSCODE_DIR/tasks.json" <<JSON
{
  "version": "2.0.0",
  "tasks": [
    { "label": "Nova: Health",       "type": "shell", "command": "${BACKEND_DIR}/health.sh",    "problemMatcher": [] },
    { "label": "Nova: Bring Up",     "type": "shell", "command": "${BACKEND_DIR}/nova_up.sh",    "problemMatcher": [] },
    { "label": "Nova: Ask (text)",   "type": "shell", "command": "\${workspaceFolder}/scripts/ask_nova.sh",        "problemMatcher": [] },
    { "label": "Nova: Ask (voice)",  "type": "shell", "command": "\${workspaceFolder}/scripts/voice_ask_nova.sh",  "problemMatcher": [] }
  ]
}
JSON

# keybindings
mkdir -p "$(dirname "$KEYB")"
[ ! -s "$KEYB" ] && echo "[]" > "$KEYB"
python3 - "$KEYB" <<'PY'
import json,sys
p=sys.argv[1]
arr=json.load(open(p))
def add(k,lab): 
  b={"key":k,"command":"workbench.action.tasks.runTask","args":lab}
  if not any(x.get("command")==b["command"] and x.get("args")==b["args"] for x in arr):
      arr.append(b)
add("cmd+alt+h","Nova: Health")
add("cmd+alt+b","Nova: Bring Up")
add("cmd+alt+n","Nova: Ask (text)")
add("cmd+alt+v","Nova: Ask (voice)")
json.dump(arr,open(p,"w"),indent=2)
print("✅ Keybindings set: Cmd+Alt+H (health), Cmd+Alt+B (bring-up), Cmd+Alt+N (text), Cmd+Alt+V (voice)")
PY

echo "🎉 Done."
echo "Next in VS Code:"
echo "  • Cmd+Alt+H → Health"
echo "  • Cmd+Alt+B → Bring Up (backend + Nova)"
echo "  • Cmd+Alt+N → Clipboard → Offline reply"
echo "  • Cmd+Alt+V → Voice 5s → Offline reply"

