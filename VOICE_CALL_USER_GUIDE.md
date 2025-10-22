# Voice Call User Guide

## 🎙️ Getting Started with Voice Calls

Voice calls allow you to have natural, real-time conversations with Atlas AI using your voice. This feature is exclusive to Studio tier subscribers.

---

## ✅ Requirements

### Desktop
- **Browser:** Chrome, Edge, Safari, or Firefox (latest version)
- **Connection:** Stable internet connection
- **Microphone:** Working microphone with permissions granted
- **Tier:** Atlas Studio subscription ($189.99/month)

### Mobile
- **Browser:** Safari (iOS) or Chrome (Android)
- **Connection:** HTTPS connection required (secure connection)
- **Microphone:** Device microphone with permissions granted
- **Tier:** Atlas Studio subscription

⚠️ **Important:** Voice calls on mobile require HTTPS. If you're accessing Atlas via HTTP (like `http://192.168.x.x`), voice calls will not work due to browser security restrictions.

---

## 🚀 How to Use

### Starting a Voice Call

1. **Look for the phone icon** - When the input box is empty, you'll see a green phone icon button (Studio users only)
2. **Click the phone button** - Opens the voice call modal
3. **Grant microphone permission** - Your browser will ask for microphone access (allow it)
4. **Click "Start Voice Call"** - The call begins immediately
5. **Start speaking** - Atlas will listen, transcribe, respond, and speak back to you

### During a Call

**Status Indicators:**
- 🟢 **Listening** - Atlas is listening to you speak
- 🟣 **Transcribing** - Converting your speech to text
- 🔵 **Thinking** - Atlas is generating a response
- 🟢 **Speaking** - Atlas is responding to you

**Controls:**
- **Mute/Unmute** - Click the microphone button or press `Space`
- **End Call** - Click the red phone button or press `Escape`
- **View Transcript** - See your last message and Atlas's response in real-time

**Keyboard Shortcuts:**
- `Space` - Toggle mute/unmute
- `Escape` - End call

---

## 💡 Tips for Best Results

### For Clear Transcription
1. **Speak clearly** - Articulate your words naturally
2. **Minimize background noise** - Find a quiet environment
3. **Use a good microphone** - Built-in mics work, but headset mics are better
4. **Pause briefly** - Let Atlas respond before speaking again

### Conversation Tips
1. **Be conversational** - Talk naturally as if chatting with a friend
2. **Ask follow-up questions** - Atlas remembers the conversation context
3. **Keep responses brief** - Atlas gives concise answers optimized for voice
4. **Use the transcript** - Check what was transcribed if Atlas misunderstood

---

## 🔧 Troubleshooting

### "Microphone access denied"
**Solution:** Grant microphone permissions in your browser
- **Chrome:** Settings → Privacy and security → Site settings → Microphone
- **Safari:** Preferences → Websites → Microphone
- **Mobile:** Settings → Safari/Chrome → Microphone → Allow

### "Audio recording not supported in this browser"
**Solution:** Update your browser to the latest version or switch to a supported browser (Chrome, Safari, Edge, Firefox)

### "Connection lost, retrying..."
**Solution:** Check your internet connection. Atlas will automatically retry 3 times with exponential backoff (1s, 2s, 4s). If all retries fail, end the call and try again.

### Voice calls don't work on mobile
**Solution:** Ensure you're accessing Atlas via HTTPS (secure connection). HTTP connections cannot access microphone on mobile devices due to browser security policies.

**Options:**
1. Use desktop browser (works with HTTP)
2. Set up HTTPS with ngrok or mkcert (see mobile access guide)
3. Access via production URL (already HTTPS)

### Call ends unexpectedly
**Possible causes:**
- 30-minute maximum duration reached (Studio: unlimited daily, but 30min per call)
- Network connection lost
- Browser tab closed or refreshed

**Solution:** Simply start a new call - your conversation history is preserved

### Atlas doesn't understand me
**Solutions:**
- Speak more clearly and slowly
- Reduce background noise
- Check your microphone quality
- Ensure microphone is not muted
- Try rephrasing your question

---

## 📊 Features

### Studio Tier Benefits
- ✅ Unlimited voice calls (up to 30 minutes per call)
- ✅ HD voice quality (OpenAI TTS-1-HD)
- ✅ Automatic transcription (OpenAI Whisper)
- ✅ Real-time conversation
- ✅ Conversation history saved
- ✅ Fast 3-second response chunks
- ✅ No monthly usage limits

### Audio Processing
- **Speech-to-Text:** OpenAI Whisper (industry-leading accuracy)
- **AI Responses:** Claude Opus (highest quality model)
- **Text-to-Speech:** OpenAI TTS-1-HD with "Nova" voice
- **Chunk Size:** 3 seconds (faster responses)
- **Retry Logic:** Automatic retry with exponential backoff

---

## 🎯 Best Practices

### Before Starting a Call
1. Test your microphone in browser settings
2. Close unnecessary tabs (better performance)
3. Ensure stable internet connection
4. Find a quiet environment

### During the Call
1. Wait for status indicators (don't interrupt)
2. Speak in natural conversation pace
3. Use the transcript to verify understanding
4. Mute when not speaking (reduce background noise)

### After the Call
1. Check conversation history for full transcript
2. Continue conversation in text if needed
3. All voice messages are saved to your chat history

---

## 💰 Pricing & Usage

**Studio Tier:** $189.99/month
- Unlimited voice calls
- No per-minute charges
- Unlimited daily usage
- 30-minute maximum per call session
- HD voice quality included

**Cost per Call (Atlas's costs, not yours):**
- ~$0.36 per 10-minute call
- Includes STT, AI processing, and TTS
- You pay nothing extra - included in subscription

---

## 🔒 Privacy & Security

- Voice data is transmitted securely over HTTPS
- Audio is processed in real-time (not stored permanently)
- Transcripts are saved to your conversation history
- HTTPS required on mobile for security
- All data protected by Atlas's privacy policy

---

## ❓ FAQ

**Q: How long can a voice call last?**
A: Each call can last up to 30 minutes. You can start a new call immediately after.

**Q: Does it work on mobile?**
A: Yes, but requires HTTPS connection due to browser security requirements.

**Q: Can I see what I said?**
A: Yes! The transcript appears in real-time during the call and is saved to your conversation history.

**Q: What if I lose connection?**
A: Atlas automatically retries 3 times. If that fails, end the call and restart.

**Q: Can Free or Core users use voice calls?**
A: No, voice calls are exclusive to Studio tier. You'll see an upgrade prompt if you try to use them.

**Q: Does it support languages other than English?**
A: Currently optimized for English. Multi-language support coming soon.

---

## 📞 Support

Having issues? Check:
1. This troubleshooting guide
2. Atlas Help Center
3. Contact support: support@atlas.ai

**Tip:** When reporting issues, mention:
- Your browser and version
- Device type (desktop/mobile)
- Error message (if any)
- What you were trying to do

---

**Last Updated:** October 22, 2025  
**Version:** 1.0

