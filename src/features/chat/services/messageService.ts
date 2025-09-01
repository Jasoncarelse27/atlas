import { createClient } from '@supabase/supabase-js';
import { appendMessage as cacheAppend, setMessageStatus, toCachedMessage } from '../../../lib/conversationStore';
import getBaseUrl from '../../../utils/getBaseUrl';
import type { Message } from '../../types/chat';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SendMessageRequest {
  message: string;
  conversationId?: string;
  model?: 'claude' | 'groq' | 'opus';
  userTier?: 'free' | 'core' | 'studio';
  userId?: string;
}

export interface SendMessageResponse {
  success: boolean;
  message: Message;
  response: Message;
  conversationId: string;
}

export interface GetMessagesResponse {
  messages: Message[];
}

class MessageService {
  private async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  private async makeAuthenticatedRequest(
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAuthToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || getBaseUrl();
    
    return fetch(`${backendUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    // cache outgoing user message as sending
    const conversationId = request.conversationId || crypto.randomUUID();
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: { type: 'text', text: request.message },
      timestamp: new Date().toISOString()
    } as Message;
    await cacheAppend(toCachedMessage(conversationId, userMsg, 'sending'));

    const response = await this.makeAuthenticatedRequest('/message', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    const data = await response.json();
    // mark user message sent and cache assistant
    await setMessageStatus(userMsg.id, 'sent');
    await cacheAppend(toCachedMessage(data.conversationId, data.response, 'sent'));
    return data;
  }

  async sendMessageStream(request: SendMessageRequest, onChunk: (chunk: string) => void): Promise<SendMessageResponse> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('No authentication token available');
    const backendUrl = import.meta.env.VITE_BACKEND_URL || getBaseUrl();
    const conversationId = request.conversationId || crypto.randomUUID();
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: { type: 'text', text: request.message },
      timestamp: new Date().toISOString()
    } as Message;
    await cacheAppend(toCachedMessage(conversationId, userMsg, 'sending'));
    const response = await fetch(`${backendUrl}/message?stream=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(request)
    });
    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => '');
      await setMessageStatus(userMsg.id, 'failed');
      throw new Error(errText || 'Failed to stream message');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const parts = buffered.split('\n\n');
      buffered = parts.pop() || '';
      for (const part of parts) {
        if (part.startsWith('data:')) {
          const payload = part.slice(5).trim();
          try {
            const json = JSON.parse(payload);
            if (json.chunk) onChunk(json.chunk);
            if (json.done) {
              await setMessageStatus(userMsg.id, 'sent');
              await cacheAppend(toCachedMessage(json.conversationId, json.response, 'sent'));
              return {
                success: true,
                message: {
                  id: 'temp',
                  role: 'user',
                  content: { type: 'text', text: request.message },
                  timestamp: new Date().toISOString()
                } as any,
                response: json.response,
                conversationId: json.conversationId
              } as SendMessageResponse;
            }
          } catch {}
        }
      }
    }
    await setMessageStatus(userMsg.id, 'failed');
    throw new Error('Stream ended unexpectedly');
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const response = await this.makeAuthenticatedRequest(
      `/api/conversations/${conversationId}/messages`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch messages');
    }

    const data: GetMessagesResponse = await response.json();
    return data.messages;
  }

  async getConversationMessagesSince(conversationId: string, since: number): Promise<Message[]> {
    const response = await this.makeAuthenticatedRequest(
      `/api/conversations/${conversationId}/messages?since=${encodeURIComponent(String(since))}`
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch incremental messages');
    }
    const data: GetMessagesResponse = await response.json();
    return data.messages;
  }

  async storeMessageLocally(message: Message): Promise<void> {
    // Store in local storage for offline support
    const key = `message_${message.id}`;
    localStorage.setItem(key, JSON.stringify(message));
  }

  async getStoredMessage(messageId: string): Promise<Message | null> {
    const key = `message_${messageId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }

  async clearStoredMessages(): Promise<void> {
    // Clear all stored messages
    const keys = Object.keys(localStorage);
    const messageKeys = keys.filter(key => key.startsWith('message_'));
    messageKeys.forEach(key => localStorage.removeItem(key));
  }
}

export const messageService = new MessageService();
export default messageService;
