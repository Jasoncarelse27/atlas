# server.py  — Nova Offline Backend (LM Studio + faster-whisper + Piper TTS)
import os, io, base64, shutil, tempfile, subprocess, math
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Form, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import httpx

from faster_whisper import WhisperModel

LMSTUDIO_URL = os.getenv("LMSTUDIO_URL", "http://127.0.0.1:1234")
LMSTUDIO_MODEL_DEFAULT = os.getenv("LMSTUDIO_MODEL", "default")

WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "auto")

# Piper config
PIPER_BIN = shutil.which(os.getenv("PIPER_BIN", "piper"))
PIPER_VOICE = os.getenv("PIPER_VOICE", "")  # path to *.onnx voice (and *.json in same dir)

app = FastAPI(title="Nova Offline Backend", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# init Whisper once (offline STT)
whisper = WhisperModel(WHISPER_MODEL_NAME, compute_type=WHISPER_COMPUTE_TYPE)


@app.get("/health")
def health():
    """Report status of local engines and config."""
    lm_ok = False
    lm_msg = ""
    try:
        r = httpx.get(f"{LMSTUDIO_URL}/v1/models", timeout=3)
        lm_ok = r.status_code == 200
        lm_msg = "ok" if lm_ok else f"HTTP {r.status_code}"
    except Exception as e:
        lm_msg = f"error: {e}"

    piper_ok = bool(PIPER_BIN) and bool(PIPER_VOICE) and os.path.exists(PIPER_VOICE)
    whisper_ok = True  # if init failed, we wouldn't reach here

    return {
        "mode": "offline",
        "lm_studio": {"url": LMSTUDIO_URL, "ok": lm_ok, "note": lm_msg, "default_model": LMSTUDIO_MODEL_DEFAULT},
        "whisper": {"model": WHISPER_MODEL_NAME, "compute": WHISPER_COMPUTE_TYPE, "ok": whisper_ok},
        "piper": {"bin": PIPER_BIN or "", "voice": PIPER_VOICE, "ok": piper_ok},
    }


@app.post("/chat")
def chat(prompt: str = Form(...), model: str = Form(LMSTUDIO_MODEL_DEFAULT)):
    """Non-streaming chat via LM Studio."""
    try:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "stream": False,
        }
        r = httpx.post(f"{LMSTUDIO_URL}/v1/chat/completions", json=payload, timeout=120)
        r.raise_for_status()
        data = r.json()
        text = data["choices"][0]["message"]["content"].strip()
        return {"provider": "lmstudio", "model": model, "text": text}
    except Exception as e:
        raise HTTPException(500, f"LM Studio error: {e}")


def _sse_format(event: str | None = None, data: str = "") -> bytes:
    # Basic SSE line formatting
    out = []
    if event:
        out.append(f"event: {event}")
    # split to avoid very long lines
    for line in data.splitlines() or [""]:
        out.append(f"data: {line}")
    out.append("")  # blank line ends the event
    return ("\n".join(out) + "\n").encode("utf-8")


@app.get("/chat_stream")
async def chat_stream(
    prompt: str = Query(..., description="User prompt"),
    model: str = Query(LMSTUDIO_MODEL_DEFAULT, description="LM Studio model id"),
):
    """
    SSE streaming endpoint.
    If LM Studio streaming is not available, we simulate chunking after a single completion.
    """
    async def gen() -> AsyncGenerator[bytes, None]:
        # announce start
        yield _sse_format("start", '{"status":"starting"}')

        # 1) get full completion
        text = ""
        try:
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "stream": False,  # LM Studio stream=false; we chunk ourselves
            }
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(f"{LMSTUDIO_URL}/v1/chat/completions", json=payload)
                r.raise_for_status()
                data = r.json()
                text = data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            yield _sse_format("error", f'{{"message": "LM Studio error: {str(e)}"}}')
            yield _sse_format("end", '{"status":"error"}')
            return

        # 2) chunk into ~40 char bits to simulate token stream
        CHUNK = 40
        for i in range(0, len(text), CHUNK):
            piece = text[i : i + CHUNK]
            yield _sse_format("token", piece)

        yield _sse_format("done", '{"status":"ok"}')
        yield _sse_format("end", '{"status":"complete"}')

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.post("/stt")
async def stt(file: UploadFile = File(...), language: str = Form("en")):
    """Transcribe audio -> text (offline)."""
    with tempfile.NamedTemporaryFile(suffix=file.filename, delete=False) as tmp:
        raw = await file.read()
        tmp.write(raw)
        path = tmp.name

    segments, info = whisper.transcribe(path, language=language, vad_filter=True)
    os.unlink(path)
    text = "".join(seg.text for seg in segments).strip()
    return {"text": text, "language": info.language, "duration": info.duration}


@app.post("/tts")
def tts(text: str = Form(...)):
    """
    Offline TTS with Piper -> return audio/wav stream.
    Requires: PIPER_BIN, PIPER_VOICE.
    """
    if not (PIPER_BIN and PIPER_VOICE and os.path.exists(PIPER_VOICE)):
        raise HTTPException(status_code=501, detail="Piper TTS not configured. Set PIPER_BIN and PIPER_VOICE.")

    # Piper produces WAV to file; we stream it back
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name

    try:
        # Piper args:
        #   -m VOICE.onnx  -f output.wav  -t text
        subprocess.run([PIPER_BIN, "-m", PIPER_VOICE, "-f", wav_path, "-t", text], check=True)
    except subprocess.CalledProcessError as e:
        raise HTTPException(500, f"Piper failed: {e}")

    def wav_iter():
        with open(wav_path, "rb") as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                yield chunk
        os.unlink(wav_path)

    return StreamingResponse(wav_iter(), media_type="audio/wav")


@app.post("/voice-chat")
async def voice_chat(file: UploadFile = File(...), model: str = Form(LMSTUDIO_MODEL_DEFAULT), language: str = Form("en")):
    """
    One-shot: audio -> STT -> LM Studio -> TTS (offline).
    Returns JSON { text, mime, audio_base64 } (WAV in base64).
    """
    # Save audio
    with tempfile.NamedTemporaryFile(suffix=file.filename, delete=False) as tmp:
        raw = await file.read()
        tmp.write(raw)
        apath = tmp.name

    # STT
    segments, info = whisper.transcribe(apath, language=language, vad_filter=True)
    os.unlink(apath)
    user_text = "".join(seg.text for seg in segments).strip()

    # Chat
    try:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": user_text}],
            "temperature": 0.2,
            "stream": False,
        }
        r = httpx.post(f"{LMSTUDIO_URL}/v1/chat/completions", json=payload, timeout=120)
        r.raise_for_status()
        data = r.json()
        reply = data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        raise HTTPException(500, f"LM Studio error: {e}")

    # TTS (Piper -> WAV -> base64)
    if not (PIPER_BIN and PIPER_VOICE and os.path.exists(PIPER_VOICE)):
        raise HTTPException(501, detail="Piper TTS not configured for /voice-chat.")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    try:
        subprocess.run([PIPER_BIN, "-m", PIPER_VOICE, "-f", wav_path, "-t", reply], check=True)
        with open(wav_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        os.unlink(wav_path)
    except Exception as e:
        raise HTTPException(500, f"Piper TTS error: {e}")

    return JSONResponse({"text": reply, "mime": "audio/wav", "audio_base64": b64, "prompt": user_text})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
