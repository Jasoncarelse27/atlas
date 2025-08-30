#!/usr/bin/env bash
set -euo pipefail
API="http://127.0.0.1:8000"
TMPWAV="/tmp/nova_voice_input.wav"

# Record 5s via sox
sox -d -c 1 -r 16000 -b 16 "$TMPWAV" trim 0 5

RESP_JSON="$(curl -s -X POST "$API/voice-chat" -F "file=@$TMPWAV")"
echo "$RESP_JSON" > /tmp/nova_voice.json

python3 - <<'PY' "/tmp/nova_voice.json"
import json,base64,pathlib,sys
data=json.load(open(sys.argv[1]))
txt=data.get("text","").strip()
print("Nova:", txt)
pathlib.Path("/tmp/nova_voice_reply.txt").write_text(txt)
if "audio_base64" in data:
    audio=base64.b64decode(data["audio_base64"])
    p=pathlib.Path("/tmp/nova_voice_reply.wav")
    p.write_bytes(audio)
PY

[ -f /tmp/nova_voice_reply.wav ] && afplay /tmp/nova_voice_reply.wav >/dev/null 2>&1 || true
command -v code >/dev/null 2>&1 && code -r /tmp/nova_voice_reply.txt || true

