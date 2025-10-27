// Edge Function for Voice V2 - WebSocket Handler
// Runtime: Vercel Edge (Deno)

export const config = {
  runtime: 'edge',
};

interface VoiceSession {
  sessionId: string;
  userId: string;
  conversationId: string;
  startTime: Date;
  lastActivityTime: Date; // ✅ Track last activity for cleanup
  status: 'initializing' | 'connected' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
  
  // ✅ COST TRACKING: Track usage metrics
  costs: {
    deepgramSeconds: number;
    claudeTokensInput: number;
    claudeTokensOutput: number;
    ttsCharacters: number;
    estimatedTotal: number;
  };
}

// In-memory session storage (per Edge instance)
const activeSessions = new Map<string, VoiceSession>();

// ✅ RATE LIMITING: Track concurrent sessions per user
const userSessionCounts = new Map<string, number>();
const MAX_CONCURRENT_SESSIONS_PER_USER = 3;

// ✅ COST TRACKING: Budget limits
const MAX_COST_PER_SESSION = 5.0; // $5 per session
const MAX_SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const BUDGET_WARNING_THRESHOLD = 0.8; // Warn at 80%

/**
 * 🎙️ Voice V2 - WebSocket Handler
 * 
 * This Edge Function handles real-time voice conversations via WebSocket.
 * 
 * Protocol:
 * - Client sends: Raw PCM audio (Int16Array, 16kHz mono)
 * - Client receives: JSON messages (transcripts, audio chunks, status)
 */
export default async function handler(req: Request): Promise<Response> {
  // Handle WebSocket upgrade
  const upgrade = req.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // Upgrade to WebSocket (Deno API)
  // @ts-ignore - Deno global available in Edge runtime
  const { socket, response } = Deno.upgradeWebSocket(req);
  const sessionId = crypto.randomUUID();
  
  console.log(`[VoiceV2] 🔌 WebSocket upgrade requested - Session: ${sessionId}`);

  // Handle connection open
  socket.onopen = () => {
    console.log(`[VoiceV2] ✅ Session ${sessionId} connected`);
    
    // Send welcome message
    socket.send(JSON.stringify({
      type: 'connected',
      sessionId,
      message: 'Voice V2 WebSocket connected',
      timestamp: new Date().toISOString(),
    }));
  };

  // Handle incoming messages
  socket.onmessage = async (event: MessageEvent) => {
    try {
      // Check if it's binary audio data
      if (event.data instanceof ArrayBuffer) {
        await handleAudioChunk(sessionId, event.data, socket);
      } else {
        // It's a text message (JSON)
        const message = JSON.parse(event.data);
        await handleControlMessage(sessionId, message, socket);
      }
    } catch (error) {
      console.error(`[VoiceV2] ❌ Error handling message:`, error);
      socket.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      }));
    }
  };

  // Handle connection close
  socket.onclose = () => {
    console.log(`[VoiceV2] 🔴 Session ${sessionId} closed`);
    cleanupSession(sessionId);
  };

  // Handle errors
  socket.onerror = (error: Event) => {
    console.error(`[VoiceV2] ❌ WebSocket error for session ${sessionId}:`, error);
    cleanupSession(sessionId);
  };

  return response;
}

/**
 * Handle incoming audio chunks
 */
async function handleAudioChunk(
  sessionId: string,
  audioData: ArrayBuffer,
  socket: WebSocket
): Promise<void> {
  // ✅ RATE LIMITING: Validate audio chunk size
  const MIN_CHUNK_SIZE = 100; // 100 bytes
  const MAX_CHUNK_SIZE = 100 * 1024; // 100 KB
  
  if (audioData.byteLength < MIN_CHUNK_SIZE) {
    socket.send(JSON.stringify({
      type: 'error',
      message: `Audio chunk too small: ${audioData.byteLength} bytes (min: ${MIN_CHUNK_SIZE})`,
      code: 'CHUNK_TOO_SMALL',
      sessionId,
    }));
    return;
  }
  
  if (audioData.byteLength > MAX_CHUNK_SIZE) {
    socket.send(JSON.stringify({
      type: 'error',
      message: `Audio chunk too large: ${audioData.byteLength} bytes (max: ${MAX_CHUNK_SIZE})`,
      code: 'CHUNK_TOO_LARGE',
      sessionId,
    }));
    return;
  }
  
  let session = activeSessions.get(sessionId);
  
  // Initialize session if first audio chunk
  if (!session) {
    session = {
      sessionId,
      userId: '', // TODO: Get from auth token
      conversationId: '',
      startTime: new Date(),
      lastActivityTime: new Date(), // ✅ Track activity
      status: 'listening',
      costs: {
        deepgramSeconds: 0,
        claudeTokensInput: 0,
        claudeTokensOutput: 0,
        ttsCharacters: 0,
        estimatedTotal: 0,
      },
    };
    activeSessions.set(sessionId, session);
    console.log(`[VoiceV2] 📝 Session ${sessionId} initialized`);
  } else {
    // ✅ Update last activity time
    session.lastActivityTime = new Date();
    
    // ✅ COST TRACKING: Check budget limits
    const sessionDuration = Date.now() - session.startTime.getTime();
    if (session.costs.estimatedTotal >= MAX_COST_PER_SESSION) {
      socket.send(JSON.stringify({
        type: 'error',
        message: `Budget limit exceeded: $${MAX_COST_PER_SESSION} per session`,
        code: 'BUDGET_EXCEEDED',
        sessionId,
        cost: session.costs.estimatedTotal,
      }));
      socket.close(4009, 'Budget exceeded');
      return;
    }
    
    if (sessionDuration >= MAX_SESSION_DURATION_MS) {
      socket.send(JSON.stringify({
        type: 'error',
        message: `Session duration limit exceeded: ${MAX_SESSION_DURATION_MS / 60000} minutes`,
        code: 'DURATION_EXCEEDED',
        sessionId,
      }));
      socket.close(4010, 'Duration exceeded');
      return;
    }
    
    // Warn at 80% of budget
    if (
      session.costs.estimatedTotal >= MAX_COST_PER_SESSION * BUDGET_WARNING_THRESHOLD &&
      session.costs.estimatedTotal < MAX_COST_PER_SESSION * (BUDGET_WARNING_THRESHOLD + 0.05)
    ) {
      socket.send(JSON.stringify({
        type: 'warning',
        message: `Approaching budget limit: $${session.costs.estimatedTotal.toFixed(2)} / $${MAX_COST_PER_SESSION}`,
        code: 'BUDGET_WARNING',
        sessionId,
        cost: session.costs.estimatedTotal,
      }));
    }
  }

  // Echo back for now (Week 1 test)
  console.log(`[VoiceV2] 🎤 Received ${audioData.byteLength} bytes of audio from session ${sessionId}`);
  
  socket.send(JSON.stringify({
    type: 'audio_received',
    sessionId,
    size: audioData.byteLength,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Handle control messages (session_start, mute, unmute, etc.)
 */
async function handleControlMessage(
  sessionId: string,
  message: any,
  socket: WebSocket
): Promise<void> {
  console.log(`[VoiceV2] 📨 Control message for session ${sessionId}:`, message.type);

  switch (message.type) {
    case 'session_start': {
      // ✅ SECURITY: Validate authentication token
      const authToken = message.authToken;
      
      if (!authToken) {
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
          sessionId,
        }));
        socket.close(4001, 'Authentication required');
        return;
      }

      // Validate JWT with Supabase
      try {
        // Import Supabase dynamically for Edge runtime
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: { user }, error } = await supabase.auth.getUser(authToken);
        
        if (error || !user) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid or expired authentication token',
            code: 'AUTH_INVALID',
            sessionId,
          }));
          socket.close(4001, 'Authentication failed');
          return;
        }

        // ✅ SECURITY: Use validated userId from JWT, not client-provided
        const validatedUserId = user.id;
        
        // ✅ RATE LIMITING: Check concurrent session limit
        const currentSessionCount = userSessionCounts.get(validatedUserId) || 0;
        if (currentSessionCount >= MAX_CONCURRENT_SESSIONS_PER_USER) {
          socket.send(JSON.stringify({
            type: 'error',
            message: `Rate limit exceeded: Maximum ${MAX_CONCURRENT_SESSIONS_PER_USER} concurrent sessions allowed`,
            code: 'RATE_LIMIT_EXCEEDED',
            sessionId,
          }));
          socket.close(4008, 'Rate limit exceeded');
          return;
        }
        
        // Increment session count
        userSessionCounts.set(validatedUserId, currentSessionCount + 1);
        console.log(`[VoiceV2] ✅ User ${validatedUserId} now has ${currentSessionCount + 1} active sessions`);
        
        // Initialize session with validated user details
        const session: VoiceSession = {
          sessionId,
          userId: validatedUserId,
          conversationId: message.conversationId || '',
          startTime: new Date(),
          lastActivityTime: new Date(), // ✅ Track activity
          status: 'connected',
          costs: {
            deepgramSeconds: 0,
            claudeTokensInput: 0,
            claudeTokensOutput: 0,
            ttsCharacters: 0,
            estimatedTotal: 0,
          },
        };
        activeSessions.set(sessionId, session);
        
        console.log(`[VoiceV2] ✅ Session authenticated for user: ${validatedUserId}`);
        
        socket.send(JSON.stringify({
          type: 'session_started',
          sessionId,
          status: 'ready',
        }));
      } catch (authError) {
        console.error(`[VoiceV2] ❌ Authentication error:`, authError);
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Authentication failed',
          code: 'AUTH_ERROR',
          sessionId,
        }));
        socket.close(4001, 'Authentication error');
        return;
      }
      break;
    }

    case 'ping':
      // Health check
      socket.send(JSON.stringify({
        type: 'pong',
        sessionId,
        timestamp: new Date().toISOString(),
      }));
      break;

    default:
      socket.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${message.type}`,
        sessionId,
      }));
  }
}

/**
 * Cleanup session on disconnect
 */
async function cleanupSession(sessionId: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return;
  }

  const duration = Date.now() - session.startTime.getTime();
  console.log(`[VoiceV2] 🧹 Cleaning up session ${sessionId} (duration: ${duration}ms)`);
  
  // ✅ RATE LIMITING: Decrement user session count
  const userId = session.userId;
  if (userId) {
    const currentCount = userSessionCounts.get(userId) || 0;
    if (currentCount > 0) {
      userSessionCounts.set(userId, currentCount - 1);
      console.log(`[VoiceV2] 📉 User ${userId} now has ${currentCount - 1} active sessions`);
    }
    
    // Clean up if user has no more sessions
    if (currentCount <= 1) {
      userSessionCounts.delete(userId);
    }
  }
  
  // ✅ DATABASE PERSISTENCE: Save session metrics
  try {
    // Import Supabase dynamically for Edge runtime
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (supabaseUrl && supabaseServiceKey && userId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const sessionData = {
        session_id: sessionId,
        user_id: userId,
        conversation_id: session.conversationId || null,
        start_time: session.startTime.toISOString(),
        end_time: new Date().toISOString(),
        duration_ms: duration,
        status: session.status === 'ended' ? 'ended' : 'error',
        
        // STT Metrics
        stt_duration_ms: Math.round(session.costs.deepgramSeconds * 1000),
        
        // LLM Metrics
        llm_tokens_input: session.costs.claudeTokensInput,
        llm_tokens_output: session.costs.claudeTokensOutput,
        
        // TTS Metrics
        tts_characters: session.costs.ttsCharacters,
        
        // Total cost
        total_cost: session.costs.estimatedTotal,
        estimated_cost: session.costs.estimatedTotal,
      };
      
      const { error } = await supabase
        .from('voice_sessions')
        .insert(sessionData);
      
      if (error) {
        console.error(`[VoiceV2] ❌ Failed to save session to database:`, error);
      } else {
        console.log(`[VoiceV2] ✅ Session saved to database`);
      }
    }
  } catch (dbError) {
    // Log error but don't block cleanup
    console.error(`[VoiceV2] ❌ Database save error:`, dbError);
  }
  
  activeSessions.delete(sessionId);
}

/**
 * Auto-cleanup inactive sessions (>10 minutes)
 * Called periodically by the Edge runtime
 */
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000; // 10 minutes of inactivity
  
  let cleanedCount = 0;
  let totalSessions = activeSessions.size;
  
  for (const [sessionId, session] of activeSessions.entries()) {
    const inactive = now - session.lastActivityTime.getTime() > timeout;
    if (inactive) {
      console.log(`[VoiceV2] ⏰ Auto-cleanup inactive session: ${sessionId} (last activity: ${new Date(session.lastActivityTime).toISOString()})`);
      cleanupSession(sessionId);
      cleanedCount++;
    }
  }
  
  // ✅ Log cleanup statistics
  if (cleanedCount > 0) {
    console.log(`[VoiceV2] 📊 Cleanup stats: Removed ${cleanedCount}/${totalSessions} inactive sessions`);
  }
  
  // ✅ Monitor session counts
  console.log(`[VoiceV2] 📊 Active sessions: ${activeSessions.size}, Active users: ${userSessionCounts.size}`);
}, 60000); // Check every minute


