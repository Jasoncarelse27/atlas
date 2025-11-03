// Voice V2 - Shared TypeScript Types

/**
 * WebSocket Message Types (Client → Server)
 */
export interface ClientMessage {
  type: 'session_start' | 'mute' | 'unmute' | 'interrupt' | 'ping';
  userId?: string;
  conversationId?: string;
  authToken?: string;
}

/**
 * WebSocket Message Types (Server → Client)
 */
export type ServerMessage =
  | ConnectedMessage
  | SessionStartedMessage
  | AudioReceivedMessage
  | PartialTranscriptMessage
  | FinalTranscriptMessage
  | AudioChunkMessage
  | StatusMessage
  | ErrorMessage
  | PongMessage;

export interface ConnectedMessage {
  type: 'connected';
  sessionId: string;
  message: string;
  timestamp: string;
}

export interface SessionStartedMessage {
  type: 'session_started';
  sessionId: string;
  status: 'ready';
}

export interface AudioReceivedMessage {
  type: 'audio_received';
  sessionId: string;
  size: number;
  timestamp: string;
}

export interface PartialTranscriptMessage {
  type: 'partial_transcript';
  text: string;
  confidence: number;
  sessionId: string;
}

export interface FinalTranscriptMessage {
  type: 'final_transcript';
  text: string;
  confidence: number;
  sessionId: string;
}

export interface AudioChunkMessage {
  type: 'audio_chunk';
  audio: string; // base64-encoded
  sentenceIndex: number;
  sessionId: string;
}

export interface StatusMessage {
  type: 'status';
  status: 'listening' | 'transcribing' | 'thinking' | 'speaking';
  sessionId: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
  sessionId: string;
}

export interface PongMessage {
  type: 'pong';
  sessionId: string;
  timestamp: string;
}

/**
 * Voice Session State
 */
export interface VoiceSession {
  sessionId: string;
  userId: string;
  conversationId: string;
  startTime: Date;
  status: 'initializing' | 'connected' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
  
  // Metrics
  metrics?: {
    sttDuration: number;
    sttRequests: number;
    llmInputTokens: number;
    llmOutputTokens: number;
    llmLatency: number;
    ttsCharacters: number;
    ttsLatency: number;
    totalLatency: number;
  };
}

/**
 * Audio Configuration
 */
export interface AudioConfig {
  sampleRate: 16000; // 16 kHz for Deepgram
  channelCount: 1; // Mono
  encoding: 'linear16'; // PCM 16-bit
  chunkSize: number; // ✅ DYNAMIC: Computed via getOptimalBufferSize() (1024 mobile, 2048 desktop) - must be power of 2
}

/**
 * Voice Call Options (Client-side)
 */
export interface VoiceCallOptions {
  userId: string;
  conversationId: string;
  authToken: string;
  
  // Callbacks
  onConnected: () => void;
  onDisconnected: () => void;
  onPartialTranscript: (text: string, confidence: number) => void;
  onFinalTranscript: (text: string, confidence: number) => void;
  onAudioChunk: (audioBase64: string, sentenceIndex?: number) => void; // ✅ Added sentenceIndex
  onStatusChange: (status: string) => void;
  onError: (error: Error) => void;
}

