// Week 4 - WebSocket Server with Deepgram STT + Claude AI + OpenAI TTS
// Complete voice conversation: User speaks → Atlas hears → thinks → speaks back
// Architecture: Matches ChatGPT Advanced Voice Mode

import Anthropic from '@anthropic-ai/sdk';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import 'dotenv/config';
import http from 'http';
import OpenAI from 'openai';
import { WebSocketServer } from 'ws';

const PORT = 3001;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Validate API keys
if (!DEEPGRAM_API_KEY) {
  console.error('❌ DEEPGRAM_API_KEY not found in environment');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not found in environment');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment');
  process.exit(1);
}

// Initialize clients
const deepgramClient = createClient(DEEPGRAM_API_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Session storage with conversation context
const activeSessions = new Map();

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Voice V2 WebSocket Server with Deepgram STT + Claude AI + OpenAI TTS\n');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

console.log(`[VoiceV2 Local] 🚀 Starting WebSocket server on port ${PORT}...`);

wss.on('connection', (ws, req) => {
  const sessionId = crypto.randomUUID();
  
  console.log(`[VoiceV2 Local] ✅ New connection - Session: ${sessionId}`);
  
  // Initialize Deepgram live transcription
  const deepgram = deepgramClient.listen.live({
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    encoding: 'linear16',
    sample_rate: 16000,
    channels: 1,
    interim_results: true,
    utterance_end_ms: 500, // ⚡ Faster response: 0.5s pause (was 1s)
    vad_events: true,
  });

  // Store session with conversation context
  activeSessions.set(sessionId, {
    clientWs: ws,
    deepgramWs: deepgram,
    startTime: new Date(),
    audioChunks: 0,
    transcripts: 0,
    conversationHistory: [],
    userId: null,
    conversationId: null,
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId,
    message: 'Voice V2 with Deepgram STT + Claude AI + OpenAI TTS (Local Dev)',
    timestamp: new Date().toISOString(),
  }));

  // Handle Deepgram events
  deepgram.on(LiveTranscriptionEvents.Open, () => {
    console.log(`[VoiceV2 Local] ✅ Deepgram connection opened for session: ${sessionId}`);
  });

  deepgram.on(LiveTranscriptionEvents.Transcript, async (data) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    const confidence = data.channel?.alternatives?.[0]?.confidence || 0;
    const isFinal = data.is_final;

    if (transcript && transcript.length > 0) {
      const session = activeSessions.get(sessionId);
      if (!session) return;

      session.transcripts++;

      console.log(`[VoiceV2 Local] ${isFinal ? '✅ FINAL' : '📝 Partial'} transcript: "${transcript}" (${(confidence * 100).toFixed(1)}%)`);

      // Send transcript to client
      ws.send(JSON.stringify({
        type: isFinal ? 'final_transcript' : 'partial_transcript',
        text: transcript,
        confidence: confidence,
        sessionId,
        timestamp: new Date().toISOString(),
      }));

      // 🆕 On final transcript, get AI response + TTS
      if (isFinal && transcript.trim().length > 0) {
        console.log(`[VoiceV2 Local] 🤖 Sending to Claude: "${transcript}"`);
        await getClaudeResponseWithTTS(sessionId, transcript);
      }
    }
  });

  deepgram.on(LiveTranscriptionEvents.Error, (error) => {
    console.error(`[VoiceV2 Local] ❌ Deepgram error:`, error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `STT error: ${error.message}`,
      sessionId,
    }));
  });

  deepgram.on(LiveTranscriptionEvents.Close, () => {
    console.log(`[VoiceV2 Local] 🔴 Deepgram connection closed for session: ${sessionId}`);
  });

  // Handle messages from client
  ws.on('message', (data) => {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    // Check if binary audio data
    if (data instanceof Buffer) {
      const size = data.length;
      session.audioChunks++;
      
      // Forward to Deepgram
      if (deepgram.getReadyState() === 1) {
        deepgram.send(data);
      }

      // Send acknowledgment (every 10th chunk)
      if (session.audioChunks % 10 === 0) {
        ws.send(JSON.stringify({
          type: 'audio_received',
          sessionId,
          size,
          totalChunks: session.audioChunks,
          timestamp: new Date().toISOString(),
        }));
      }
    } else {
      // JSON control message
      try {
        const message = JSON.parse(data.toString());
        console.log(`[VoiceV2 Local] 📨 Control message: ${message.type}`);
        
        switch (message.type) {
          case 'session_start':
            session.userId = message.userId;
            session.conversationId = message.conversationId;
            
            ws.send(JSON.stringify({
              type: 'session_started',
              sessionId,
              status: 'ready',
            }));
            break;
            
          case 'ping':
            ws.send(JSON.stringify({
              type: 'pong',
              sessionId,
              timestamp: new Date().toISOString(),
            }));
            break;
            
          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: `Unknown message type: ${message.type}`,
              sessionId,
            }));
        }
      } catch (error) {
        console.error('[VoiceV2 Local] ❌ Parse error:', error);
      }
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    const session = activeSessions.get(sessionId);
    if (session) {
      const duration = Date.now() - session.startTime.getTime();
      console.log(`[VoiceV2 Local] 🔴 Client disconnected - Session: ${sessionId}`);
      console.log(`[VoiceV2 Local] 📊 Stats: ${session.audioChunks} audio chunks, ${session.transcripts} transcripts, ${(duration / 1000).toFixed(1)}s duration`);
      
      // Close Deepgram connection
      if (deepgram.getReadyState() === 1) {
        deepgram.finish();
      }
      
      activeSessions.delete(sessionId);
    }
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`[VoiceV2 Local] ❌ WebSocket error:`, error);
  });
});

// 🆕 WEEK 4: Claude Streaming Response + TTS
async function getClaudeResponseWithTTS(sessionId, userMessage) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const startTime = Date.now();

  try {
    // Add user message to history
    session.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Keep only last 10 messages
    if (session.conversationHistory.length > 10) {
      session.conversationHistory = session.conversationHistory.slice(-10);
    }

    console.log(`[VoiceV2 Local] 📝 Context: ${session.conversationHistory.length} messages`);

    // Stream Claude response
    const stream = await anthropic.messages.stream({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 150, // Shorter for natural conversation
      temperature: 0.7,
      system: `You're Atlas, a warm and emotionally intelligent AI companion in a voice conversation.

Voice conversation guidelines:
- Speak naturally and conversationally (use "I'm", "you're", "let's")
- Keep responses brief (1-2 sentences unless asked for detail)
- Show empathy through tone, not over-explanation
- Ask follow-up questions to deepen the conversation
- Be supportive but authentic

Example:
User: "I'm feeling stressed about work."
Atlas: "That sounds really tough. What's weighing on you most right now?"`,
      messages: session.conversationHistory,
    });

    let fullResponse = '';
    let currentSentence = '';
    let sentenceIndex = 0;

    // Send thinking status
    session.clientWs.send(JSON.stringify({
      type: 'ai_thinking',
      sessionId,
      timestamp: new Date().toISOString(),
    }));

    // Stream response chunks
    stream.on('text', (text) => {
      fullResponse += text;
      currentSentence += text;
      
      // Send text chunks to client
      session.clientWs.send(JSON.stringify({
        type: 'ai_response_chunk',
        text: text,
        fullText: fullResponse,
        sessionId,
        timestamp: new Date().toISOString(),
      }));

      // 🆕 WEEK 4: Split into sentences and generate TTS
      const sentenceMatch = currentSentence.match(/([^.!?]+[.!?]+)/);
      if (sentenceMatch) {
        const sentence = sentenceMatch[1].trim();
        currentSentence = currentSentence.substring(sentenceMatch[0].length);
        
        if (sentence.length > 3) {
          // Generate TTS for complete sentence
          generateTTS(sessionId, sentence, sentenceIndex++);
        }
      }
    });

    // Handle stream completion
    await stream.done();

    // Generate TTS for remaining text
    if (currentSentence.trim().length > 3) {
      await generateTTS(sessionId, currentSentence.trim(), sentenceIndex++);
    }

    // Add AI response to history
    session.conversationHistory.push({
      role: 'assistant',
      content: fullResponse,
    });

    const latency = Date.now() - startTime;
    console.log(`[VoiceV2 Local] ✅ Claude response complete (${latency}ms): "${fullResponse.substring(0, 80)}..."`);

    // Send final response
    session.clientWs.send(JSON.stringify({
      type: 'ai_response_complete',
      text: fullResponse,
      latency,
      sessionId,
      timestamp: new Date().toISOString(),
    }));

  } catch (error) {
    console.error(`[VoiceV2 Local] ❌ Claude error:`, error);
    session.clientWs.send(JSON.stringify({
      type: 'error',
      message: `AI error: ${error.message}`,
      sessionId,
      timestamp: new Date().toISOString(),
    }));
  }
}

// 🆕 WEEK 4: Generate TTS for sentence
async function generateTTS(sessionId, text, index) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const ttsStart = Date.now();

  try {
    console.log(`[VoiceV2 Local] 🔊 Generating TTS [${index}]: "${text.substring(0, 50)}..."`);

    // Call OpenAI TTS API (Studio tier: tts-1-hd, voice: nova)
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'nova',
      input: text,
      speed: 1.0,
    });

    // Convert to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    const ttsLatency = Date.now() - ttsStart;
    console.log(`[VoiceV2 Local] ✅ TTS complete [${index}] (${ttsLatency}ms): ${buffer.length} bytes`);

    // Send audio to client
    session.clientWs.send(JSON.stringify({
      type: 'tts_audio',
      audio: base64Audio,
      text: text,
      index: index,
      latency: ttsLatency,
      sessionId,
      timestamp: new Date().toISOString(),
    }));

  } catch (error) {
    console.error(`[VoiceV2 Local] ❌ TTS error [${index}]:`, error);
    session.clientWs.send(JSON.stringify({
      type: 'error',
      message: `TTS error: ${error.message}`,
      sessionId,
      timestamp: new Date().toISOString(),
    }));
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`[VoiceV2 Local] ✅ WebSocket server running on ws://localhost:${PORT}`);
  console.log(`[VoiceV2 Local] 🎤 Deepgram STT enabled (Nova-2 model)`);
  console.log(`[VoiceV2 Local] 🤖 Claude AI enabled (Haiku 3.5 - fastest)`);
  console.log(`[VoiceV2 Local] 🔊 OpenAI TTS enabled (TTS-1-HD, voice: nova)`);
  console.log(`[VoiceV2 Local] 📝 Full voice conversation ready!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[VoiceV2 Local] 🛑 Shutting down...');
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.deepgramWs && session.deepgramWs.getReadyState() === 1) {
      session.deepgramWs.finish();
    }
  }
  
  wss.close(() => {
    server.close(() => {
      console.log('[VoiceV2 Local] ✅ Server closed');
      process.exit(0);
    });
  });
});
