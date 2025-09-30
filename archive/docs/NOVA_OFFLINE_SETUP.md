# Nova Offline Setup Guide

## Current Status ✅

Your offline Nova backend is now running with:
- ✅ **FastAPI Server**: Running on http://localhost:8000
- ✅ **Whisper STT**: Ready for speech-to-text
- ⚠️ **LM Studio**: Needs to be running on port 1234
- ⚠️ **Piper TTS**: Needs installation and voice model

## Next Steps

### 1. Start LM Studio
1. Open LM Studio
2. Load a model (e.g., "qwen2.5-coder:7b" or any model you prefer)
3. Start the local server on port 1234
4. Test: `curl http://127.0.0.1:1234/v1/models`

### 2. Install Piper TTS (Optional)
```bash
# Install sox for audio recording
brew install sox

# Install Piper manually (not in Homebrew)
# Download from: https://github.com/rhasspy/piper/releases
# Or use alternative TTS solutions
```

### 3. Set Environment Variables
Add to your `~/.zshrc`:
```bash
export LMSTUDIO_URL="http://127.0.0.1:1234"
export LMSTUDIO_MODEL="your-model-name"
export PIPER_BIN="/path/to/piper"
export PIPER_VOICE="/path/to/voice.onnx"
```

### 4. Test the System
1. **Health Check**: `curl http://localhost:8000/health`
2. **Text Chat**: Open `index.html` in browser
3. **Voice Chat**: Use the voice input features

## VS Code Integration

The scripts are ready:
- `scripts/ask_nova.sh` - Text input (clipboard)
- `scripts/voice_ask_nova.sh` - Voice input (requires sox)

## Features Available

### Text Chat
- Streaming responses via SSE
- Real-time token display
- Automatic TTS (when configured)

### Voice Chat
- Speech-to-text via Whisper
- AI response via LM Studio
- Text-to-speech via Piper

### API Endpoints
- `GET /health` - System status
- `POST /chat` - Non-streaming chat
- `GET /chat_stream` - Streaming chat (SSE)
- `POST /stt` - Speech-to-text
- `POST /tts` - Text-to-speech
- `POST /voice-chat` - Full voice conversation

## Troubleshooting

### LM Studio Connection Issues
- Ensure LM Studio is running on port 1234
- Check model is loaded and ready
- Test with: `curl http://127.0.0.1:1234/v1/models`

### TTS Issues
- Piper not installed: TTS will be skipped gracefully
- Use alternative TTS solutions if needed

### Whisper Issues
- Model downloads automatically on first use
- Check internet connection for initial download

## Usage Examples

### Browser Interface
1. Open `index.html`
2. Type messages and press Enter
3. Watch streaming responses
4. Use "Speak Reply" for TTS

### Command Line
```bash
# Text chat
curl -X POST http://localhost:8000/chat -F "prompt=Hello Nova"

# Voice chat (requires audio file)
curl -X POST http://localhost:8000/voice-chat -F "file=@audio.wav"
```

Your Nova offline backend is ready to use! 🚀

