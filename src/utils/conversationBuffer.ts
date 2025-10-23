/**
 * Atlas Conversational Buffer
 * Manages rolling chat memory for both text and voice sessions.
 * Designed for Claude / Groq / OpenAI-compatible models.
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export class ConversationBuffer {
  private messages: Message[] = [];
  private readonly maxMessages: number;

  constructor(maxMessages = 10) {
    this.maxMessages = maxMessages;
  }

  /** Add a new message to the buffer */
  add(role: Message['role'], content: string) {
    if (!content?.trim()) return;
    this.messages.push({ role, content, timestamp: Date.now() });
    this.trim();
  }

  /** Get the conversation history formatted for LLM API */
  getContext(): Message[] {
    return [...this.messages];
  }

  /** Get the last N messages for voice session continuity */
  getRecent(n = 5): Message[] {
    return this.messages.slice(-n);
  }

  /** Clear entire buffer (on conversation end or logout) */
  clear() {
    this.messages = [];
  }

  /** Remove oldest messages if buffer exceeds limit */
  private trim() {
    const excess = this.messages.length - this.maxMessages;
    if (excess > 0) this.messages.splice(0, excess);
  }
}

/** Singleton buffer for voice sessions */
export const conversationBuffer = new ConversationBuffer(10);

