/* eslint-env node */
/* eslint-disable no-console */
// Voice V2 Production Server - Fly.io Deployment
// Complete voice conversation: User speaks → Atlas hears → thinks → speaks back
// Architecture: Matches ChatGPT Advanced Voice Mode

import Anthropic from '@anthropic-ai/sdk';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import 'dotenv/config';
import http from 'http';
import OpenAI from 'openai';
import { WebSocketServer } from 'ws';

// Cost calculation (inline for simplicity)
const PRICING = {
  deepgramPerMinute: 0.0043,
  claudeHaikuInputPer1M: 0.25,
  claudeHaikuOutputPer1M: 1.25,
  openaiTTSPer1M: 15.0,
};

function calculateTotalCost(metrics) {
  const sttCost = (metrics.deepgramDurationMs / 60000) * PRICING.deepgramPerMinute;
  const llmCost = (metrics.claudeInputTokens / 1_000_000) * PRICING.claudeHaikuInputPer1M +
                  (metrics.claudeOutputTokens / 1_000_000) * PRICING.claudeHaikuOutputPer1M;
  const ttsCost = (metrics.ttsCharacters / 1_000_000) * PRICING.openaiTTSPer1M;
  return sttCost + llmCost + ttsCost;
}

const PORT = process.env.PORT || 3001;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// Rate limiting: Track concurrent sessions per user
const userSessionCounts = new Map();
const MAX_CONCURRENT_SESSIONS_PER_USER = 3;

// Cost limits
const MAX_COST_PER_SESSION = 5.0; // $5 per session
const MAX_SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const BUDGET_WARNING_THRESHOLD = 0.8; // Warn at 80%

// Create HTTP server
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      activeSessions: activeSessions.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Voice V2 WebSocket Server with Deepgram STT + Claude AI + OpenAI TTS\n');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

console.log(`[VoiceV2] 🚀 Starting WebSocket server on port ${PORT}...`);

wss.on('connection', (ws, req) => {
  const sessionId = crypto.randomUUID();
  
  console.log(`[VoiceV2] ✅ New connection - Session: ${sessionId}`);

  // Initialize session (will be authenticated on session_start)
  let session = {
    clientWs: ws,
    deepgramWs: null,
    startTime: new Date(),
    lastActivityTime: new Date(),
    audioChunks: 0,
    transcripts: 0,
    conversationHistory: [],
    userId: null,
    conversationId: null,
    authenticated: false,
    metrics: {
      deepgramDurationMs: 0,
      claudeInputTokens: 0,
      claudeOutputTokens: 0,
      ttsCharacters: 0,
    },
  };

  activeSessions.set(sessionId, session);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId,
    message: 'Voice V2 WebSocket connected',
    timestamp: new Date().toISOString(),
  }));

  // Handle messages from client
  ws.on('message', async (data) => {
    session.lastActivityTime = new Date();

    // Check if binary audio data
    if (data instanceof Buffer) {
      // ✅ SECURITY: Require authentication before processing audio
      if (!session.authenticated) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Session not authenticated. Send session_start first.',
          code: 'AUTH_REQUIRED',
          sessionId,
        }));
        return;
      }

      const size = data.length;
      session.audioChunks++;
      
      // Forward to Deepgram (create connection if needed)
      if (!session.deepgramWs) {
        session.deepgramWs = deepgramClient.listen.live({
          model: 'nova-2',
          language: 'en',
          smart_format: true,
          encoding: 'linear16',
          sample_rate: 16000,
          channels: 1,
          interim_results: true,
          utterance_end_ms: 500, // ⚡ Faster response: 0.5s pause
          vad_events: true,
        });

        // Handle Deepgram events
        session.deepgramWs.on(LiveTranscriptionEvents.Open, () => {
          console.log(`[VoiceV2] ✅ Deepgram connection opened for session: ${sessionId}`);
          session.metrics.deepgramDurationMs = Date.now() - session.startTime.getTime();
        });

        session.deepgramWs.on(LiveTranscriptionEvents.Transcript, async (event) => {
          const transcript = event.channel?.alternatives?.[0]?.transcript;
          const confidence = event.channel?.alternatives?.[0]?.confidence || 0;
          const isFinal = event.is_final;

          if (transcript && transcript.length > 0) {
            session.transcripts++;

            console.log(`[VoiceV2] ${isFinal ? '✅ FINAL' : '📝 Partial'} transcript: "${transcript}" (${(confidence * 100).toFixed(1)}%)`);

            // Send transcript to client
            ws.send(JSON.stringify({
              type: isFinal ? 'final_transcript' : 'partial_transcript',
              text: transcript,
              confidence: confidence,
              sessionId,
              timestamp: new Date().toISOString(),
            }));

            // On final transcript, get AI response + TTS
            if (isFinal && transcript.trim().length > 0) {
              console.log(`[VoiceV2] 🤖 Sending to Claude: "${transcript}"`);
              await getClaudeResponseWithTTS(sessionId, transcript);
            }
          }
        });

        session.deepgramWs.on(LiveTranscriptionEvents.Error, (error) => {
          console.error(`[VoiceV2] ❌ Deepgram error:`, error);
          ws.send(JSON.stringify({
            type: 'error',
            message: `STT error: ${error.message}`,
            sessionId,
          }));
        });

        session.deepgramWs.on(LiveTranscriptionEvents.Close, () => {
          console.log(`[VoiceV2] 🔴 Deepgram connection closed for session: ${sessionId}`);
        });
      }
      
      // Forward audio to Deepgram
      if (session.deepgramWs.getReadyState() === 1) {
        session.deepgramWs.send(data);
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
        console.log(`[VoiceV2] 📨 Control message: ${message.type}`);
        
        switch (message.type) {
          case 'session_start': {
            // ✅ SECURITY: Validate authentication token
            const authToken = message.authToken;
            
            if (!authToken) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Authentication required',
                code: 'AUTH_REQUIRED',
                sessionId,
              }));
              ws.close(4001, 'Authentication required');
              return;
            }

            // Validate JWT with Supabase
            try {
              const { createClient } = await import('@supabase/supabase-js');
              const supabaseUrl = SUPABASE_URL || '';
              const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
              
              if (!supabaseUrl || !supabaseKey) {
                throw new Error('Supabase configuration missing');
              }

              const supabase = createClient(supabaseUrl, supabaseKey);
              const { data: { user }, error } = await supabase.auth.getUser(authToken);
              
              if (error || !user) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Invalid or expired authentication token',
                  code: 'AUTH_INVALID',
                  sessionId,
                }));
                ws.close(4001, 'Authentication failed');
                return;
              }

              // ✅ SECURITY: Use validated userId from JWT
              const validatedUserId = user.id;
              
              // ✅ RATE LIMITING: Check concurrent session limit
              const currentSessionCount = userSessionCounts.get(validatedUserId) || 0;
              if (currentSessionCount >= MAX_CONCURRENT_SESSIONS_PER_USER) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: `Rate limit exceeded: Maximum ${MAX_CONCURRENT_SESSIONS_PER_USER} concurrent sessions allowed`,
                  code: 'RATE_LIMIT_EXCEEDED',
                  sessionId,
                }));
                ws.close(4008, 'Rate limit exceeded');
                return;
              }
              
              // Increment session count
              userSessionCounts.set(validatedUserId, currentSessionCount + 1);
              console.log(`[VoiceV2] ✅ User ${validatedUserId} now has ${currentSessionCount + 1} active sessions`);

              // Update session with authenticated user
              session.userId = validatedUserId;
              session.conversationId = message.conversationId || '';
              session.authenticated = true;
              
              ws.send(JSON.stringify({
                type: 'session_started',
                sessionId,
                status: 'ready',
              }));
            } catch (authError) {
              console.error(`[VoiceV2] ❌ Authentication error:`, authError);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Authentication failed',
                code: 'AUTH_ERROR',
                sessionId,
              }));
              ws.close(4001, 'Authentication error');
              return;
            }
            break;
          }
            
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
        console.error('[VoiceV2] ❌ Parse error:', error);
      }
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    const session = activeSessions.get(sessionId);
    if (session) {
      const duration = Date.now() - session.startTime.getTime();
      console.log(`[VoiceV2] 🔴 Client disconnected - Session: ${sessionId}`);
      console.log(`[VoiceV2] 📊 Stats: ${session.audioChunks} audio chunks, ${session.transcripts} transcripts, ${(duration / 1000).toFixed(1)}s duration`);
      
      // Close Deepgram connection
      if (session.deepgramWs && session.deepgramWs.getReadyState() === 1) {
        session.deepgramWs.finish();
      }
      
      // Decrement user session count
      if (session.userId) {
        const currentCount = userSessionCounts.get(session.userId) || 0;
        if (currentCount > 0) {
          userSessionCounts.set(session.userId, currentCount - 1);
        }
        if (currentCount <= 1) {
          userSessionCounts.delete(session.userId);
        }
      }

      // Save session to database
      saveSessionToDatabase(sessionId, session, duration);
      
      activeSessions.delete(sessionId);
    }
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`[VoiceV2] ❌ WebSocket error:`, error);
  });
});

// Claude Streaming Response + TTS
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

    console.log(`[VoiceV2] 📝 Context: ${session.conversationHistory.length} messages`);

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
    let inputTokens = 0;
    let outputTokens = 0;

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

      // Split into sentences and generate TTS
      const sentenceMatch = currentSentence.match(/([^.!?]+[.!?]+)/);
      if (sentenceMatch) {
        const sentence = sentenceMatch[1].trim();
        currentSentence = currentSentence.substring(sentenceMatch[0].length);
        
        if (sentence.length > 3) {
          // Generate TTS for complete sentence (non-blocking)
          generateTTS(sessionId, sentence, sentenceIndex++).catch(err => {
            console.error(`[VoiceV2] ❌ TTS error:`, err);
          });
        }
      }
    });

    // Handle stream completion
    await stream.done();

    // Get actual token counts from stream
    const usage = await stream.getFinalUsage();
    if (usage) {
      inputTokens = usage.input_tokens || 0;
      outputTokens = usage.output_tokens || 0;
    } else {
      // Fallback: estimate tokens (rough approximation)
      inputTokens = Math.ceil(session.conversationHistory.reduce((sum, msg) => sum + msg.content.length, 0) / 4);
      outputTokens = Math.ceil(fullResponse.length / 4);
    }

    // Update metrics
    session.metrics.claudeInputTokens += inputTokens;
    session.metrics.claudeOutputTokens += outputTokens;

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
    console.log(`[VoiceV2] ✅ Claude response complete (${latency}ms): "${fullResponse.substring(0, 80)}..."`);

    // Check cost limits
    const totalCost = calculateTotalCost(session.metrics);
    if (totalCost >= MAX_COST_PER_SESSION) {
      session.clientWs.send(JSON.stringify({
        type: 'error',
        message: `Budget limit exceeded: $${totalCost.toFixed(2)}`,
        code: 'BUDGET_EXCEEDED',
        sessionId,
      }));
      session.clientWs.close(4009, 'Budget exceeded');
      return;
    }

    // Warn at 80% of budget
    if (totalCost >= MAX_COST_PER_SESSION * BUDGET_WARNING_THRESHOLD) {
      session.clientWs.send(JSON.stringify({
        type: 'warning',
        message: `Approaching budget limit: $${totalCost.toFixed(2)} / $${MAX_COST_PER_SESSION}`,
        code: 'BUDGET_WARNING',
        sessionId,
      }));
    }

    // Send final response
    session.clientWs.send(JSON.stringify({
      type: 'ai_response_complete',
      text: fullResponse,
      latency,
      sessionId,
      timestamp: new Date().toISOString(),
    }));

  } catch (error) {
    console.error(`[VoiceV2] ❌ Claude error:`, error);
    session.clientWs.send(JSON.stringify({
      type: 'error',
      message: `AI error: ${error.message}`,
      sessionId,
      timestamp: new Date().toISOString(),
    }));
  }
}

// Generate TTS for sentence
async function generateTTS(sessionId, text, index) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const ttsStart = Date.now();

  try {
    console.log(`[VoiceV2] 🔊 Generating TTS [${index}]: "${text.substring(0, 50)}..."`);

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
    console.log(`[VoiceV2] ✅ TTS complete [${index}] (${ttsLatency}ms): ${buffer.length} bytes`);

    // Update metrics
    session.metrics.ttsCharacters += text.length;

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
    console.error(`[VoiceV2] ❌ TTS error [${index}]:`, error);
    session.clientWs.send(JSON.stringify({
      type: 'error',
      message: `TTS error: ${error.message}`,
      sessionId,
      timestamp: new Date().toISOString(),
    }));
  }
}

// Save session to database
async function saveSessionToDatabase(sessionId, session, duration) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !session.userId) {
    return; // Skip if not configured
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const totalCost = calculateTotalCost(session.metrics);

    const sessionData = {
      session_id: sessionId,
      user_id: session.userId,
      conversation_id: session.conversationId || null,
      start_time: session.startTime.toISOString(),
      end_time: new Date().toISOString(),
      duration_ms: duration,
      status: 'ended',
      
      // STT Metrics
      stt_duration_ms: session.metrics.deepgramDurationMs,
      
      // LLM Metrics
      llm_tokens_input: session.metrics.claudeInputTokens,
      llm_tokens_output: session.metrics.claudeOutputTokens,
      
      // TTS Metrics
      tts_characters: session.metrics.ttsCharacters,
      
      // Total cost
      total_cost: totalCost,
      estimated_cost: totalCost,
    };

    const { error } = await supabase
      .from('voice_sessions')
      .insert(sessionData);

    if (error) {
      console.error(`[VoiceV2] ❌ Failed to save session to database:`, error);
    } else {
      console.log(`[VoiceV2] ✅ Session saved to database`);
    }
  } catch (dbError) {
    console.error(`[VoiceV2] ❌ Database save error:`, dbError);
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`[VoiceV2] ✅ WebSocket server running on port ${PORT}`);
  console.log(`[VoiceV2] 🎤 Deepgram STT enabled (Nova-2 model)`);
  console.log(`[VoiceV2] 🤖 Claude AI enabled (Haiku 3.5 - fastest)`);
  console.log(`[VoiceV2] 🔊 OpenAI TTS enabled (TTS-1-HD, voice: nova)`);
  console.log(`[VoiceV2] 📝 Full voice conversation ready!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[VoiceV2] 🛑 Shutting down...');
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.deepgramWs && session.deepgramWs.getReadyState() === 1) {
      session.deepgramWs.finish();
    }
  }
  
  wss.close(() => {
    server.close(() => {
      console.log('[VoiceV2] ✅ Server closed');
      process.exit(0);
    });
  });
});

