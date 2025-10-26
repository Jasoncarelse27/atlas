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
  status: 'initializing' | 'connected' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
}

// In-memory session storage (per Edge instance)
const activeSessions = new Map<string, VoiceSession>();

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
  let session = activeSessions.get(sessionId);
  
  // Initialize session if first audio chunk
  if (!session) {
    session = {
      sessionId,
      userId: '', // TODO: Get from auth token
      conversationId: '',
      startTime: new Date(),
      status: 'listening',
    };
    activeSessions.set(sessionId, session);
    console.log(`[VoiceV2] 📝 Session ${sessionId} initialized`);
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
      // Initialize session with user details
      const session: VoiceSession = {
        sessionId,
        userId: message.userId || '',
        conversationId: message.conversationId || '',
        startTime: new Date(),
        status: 'connected',
      };
      activeSessions.set(sessionId, session);
      
      socket.send(JSON.stringify({
        type: 'session_started',
        sessionId,
        status: 'ready',
      }));
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
function cleanupSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    const duration = Date.now() - session.startTime.getTime();
    console.log(`[VoiceV2] 🧹 Cleaning up session ${sessionId} (duration: ${duration}ms)`);
    
    // TODO: Save session metrics to database
    
    activeSessions.delete(sessionId);
  }
}

/**
 * Auto-cleanup inactive sessions (>10 minutes)
 * Called periodically by the Edge runtime
 */
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000; // 10 minutes
  
  for (const [sessionId, session] of activeSessions.entries()) {
    const inactive = now - session.startTime.getTime() > timeout;
    if (inactive) {
      console.log(`[VoiceV2] ⏰ Auto-cleanup inactive session: ${sessionId}`);
      cleanupSession(sessionId);
    }
  }
}, 60000); // Check every minute

