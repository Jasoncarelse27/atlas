// Voice V2 - Session Manager
// Tracks active voice sessions and their state

export interface VoiceSessionMetrics {
  sttDuration: number;
  sttRequests: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmLatency: number;
  ttsCharacters: number;
  ttsLatency: number;
  totalLatency: number;
}

export interface VoiceSession {
  sessionId: string;
  userId: string;
  conversationId: string;
  
  // Connection info
  clientSocket: WebSocket;
  deepgramWs: WebSocket | null;
  
  // State
  status: 'initializing' | 'connected' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
  startTime: Date;
  lastActivityTime: Date;
  
  // Metrics
  metrics: VoiceSessionMetrics;
  
  // Conversation context (last 10 messages)
  conversationBuffer: Array<{ role: 'user' | 'assistant', content: string }>;
}

/**
 * 🗂️ Session Manager
 * 
 * Manages active voice sessions in memory (per Edge Function instance).
 * Handles session lifecycle, cleanup, and metrics tracking.
 */
export class SessionManager {
  private sessions = new Map<string, VoiceSession>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start auto-cleanup timer
    this.startAutoCleanup();
  }

  /**
   * Create a new session
   */
  create(
    sessionId: string,
    userId: string,
    conversationId: string,
    clientSocket: WebSocket
  ): VoiceSession {
    const session: VoiceSession = {
      sessionId,
      userId,
      conversationId,
      clientSocket,
      deepgramWs: null,
      status: 'initializing',
      startTime: new Date(),
      lastActivityTime: new Date(),
      metrics: {
        sttDuration: 0,
        sttRequests: 0,
        llmInputTokens: 0,
        llmOutputTokens: 0,
        llmLatency: 0,
        ttsCharacters: 0,
        ttsLatency: 0,
        totalLatency: 0,
      },
      conversationBuffer: [],
    };

    this.sessions.set(sessionId, session);
    console.log(`[SessionManager] ✅ Session created: ${sessionId} (user: ${userId})`);
    
    return session;
  }

  /**
   * Get a session by ID
   */
  get(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session status
   */
  updateStatus(
    sessionId: string,
    status: VoiceSession['status']
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.lastActivityTime = new Date();
    }
  }

  /**
   * Update session metrics
   */
  updateMetrics(
    sessionId: string,
    updates: Partial<VoiceSessionMetrics>
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metrics = { ...session.metrics, ...updates };
      session.lastActivityTime = new Date();
    }
  }

  /**
   * Add message to conversation buffer
   */
  addToBuffer(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.conversationBuffer.push({ role, content });
      
      // Keep only last 10 messages
      if (session.conversationBuffer.length > 10) {
        session.conversationBuffer = session.conversationBuffer.slice(-10);
      }
      
      session.lastActivityTime = new Date();
    }
  }

  /**
   * Delete a session
   */
  delete(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Close connections
      if (session.deepgramWs) {
        session.deepgramWs.close();
      }
      
      const duration = Date.now() - session.startTime.getTime();
      console.log(`[SessionManager] 🧹 Session deleted: ${sessionId} (duration: ${duration}ms)`);
      
      // TODO: Save metrics to database
      
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Get all active sessions
   */
  getAll(): VoiceSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  count(): number {
    return this.sessions.size;
  }

  /**
   * Auto-cleanup inactive sessions
   * Runs every minute, removes sessions inactive for > 10 minutes
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 10 * 60 * 1000; // 10 minutes
      
      let cleaned = 0;
      
      for (const [sessionId, session] of this.sessions.entries()) {
        const inactive = now - session.lastActivityTime.getTime() > timeout;
        if (inactive) {
          console.log(`[SessionManager] ⏰ Auto-cleanup: ${sessionId}`);
          this.delete(sessionId);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`[SessionManager] 🧹 Cleaned ${cleaned} inactive sessions`);
      }
    }, 60000); // Check every minute
  }

  /**
   * Stop auto-cleanup timer
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    byStatus: Record<string, number>;
    avgDuration: number;
  } {
    const now = Date.now();
    const sessions = this.getAll();
    
    const byStatus: Record<string, number> = {};
    let totalDuration = 0;
    
    for (const session of sessions) {
      // Count by status
      byStatus[session.status] = (byStatus[session.status] || 0) + 1;
      
      // Calculate duration
      totalDuration += now - session.startTime.getTime();
    }
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.length,
      byStatus,
      avgDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
    };
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

