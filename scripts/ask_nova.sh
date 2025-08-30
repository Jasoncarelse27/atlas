#!/usr/bin/env bash
set -euo pipefail
API="http://127.0.0.1:8000"

PROMPT="$(pbpaste | sed 's/"/\\"/g')"
[ -z "$PROMPT" ] && { echo "Clipboard empty — copy some text or code first."; exit 1; }

RESP="$(curl -s -X POST "$API/chat" -F "prompt=$PROMPT")"
TEXT="$(python3 - <<'PY' "$RESP"
import sys,json; data=json.loads(sys.argv[1]); print(data.get("text","").strip())
PY
)"
[ -z "$TEXT" ] && { echo "No reply from Nova."; exit 1; }

echo "$TEXT" | tee /tmp/nova_reply.txt

# New: /tts (Piper WAV stream)
curl -s -X POST "$API/tts" -F "text=$TEXT" --output /tmp/nova_reply.wav >/dev/null || true
[ -f /tmp/nova_reply.wav ] && afplay /tmp/nova_reply.wav >/dev/null 2>&1 || true

command -v code >/dev/null 2>&1 && code -r /tmp/nova_reply.txt || true

