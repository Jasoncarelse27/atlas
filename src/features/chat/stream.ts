import { CHAT_CONFIG } from '@/config/chat';
import type { Message } from './storage';

export async function streamAtlasReply(
  history: Message[],
  onToken: (chunk: string) => void,
  signal?: AbortSignal
) {
  // Use the last user message as the main message content
  const lastUserMessage = [...history].reverse().find(m => m.role === 'user');
  const messageContent = lastUserMessage?.content || 'Hello';

  const body = {
    message: messageContent,
    conversationId: 'default-conversation',
    model: CHAT_CONFIG.modelHint,
    userTier: 'free'
  };

  const res = await fetch(`${CHAT_CONFIG.apiBase}${CHAT_CONFIG.streamPath}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mock-token-for-development'
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let done = false;

  while (!done) {
    const { value, done: d } = await reader.read();
    done = d;
    if (value) {
      const txt = decoder.decode(value, { stream: true });
      // Handle SSE format from the backend
      const lines = txt.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          try {
            const data = JSON.parse(trimmed.slice(5).trim());
            if (data.chunk) {
              onToken(data.chunk);
            }
            if (data.done) {
              return; // Stream completed
            }
          } catch {
            // If not JSON, treat as raw text
            const rawData = trimmed.slice(5).trim();
            if (rawData) onToken(rawData);
          }
        }
      }
    }
  }
}
