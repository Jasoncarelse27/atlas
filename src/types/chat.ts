import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  error?: string;
  status?: 'sending' | 'sent' | 'failed';
  audioUrl?: string;
  imageUrl?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: string;
  createdAt: string;
  pinned?: boolean;
  user_id?: string;
}

export const createNewConversation = (title: string = 'New Conversation'): Conversation => {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title,
    messages: [],
    lastUpdated: now,
    createdAt: now
  };
};

export const generateConversationTitle = (messages: Message[]): string => {
  // Find the first user message to use as a title basis
  const firstUserMessage = messages.find(m => m.role === 'user');
  
  if (!firstUserMessage) {
    return 'New Conversation';
  }
  
  // Truncate the message to create a title
  const content = firstUserMessage.content;
  
  if (content.length <= 30) {
    return content;
  }
  
  // Try to find a natural break point
  const breakPoints = ['.', '?', '!', ',', ';', ':', ' '];
  
  for (const point of breakPoints) {
    const index = content.indexOf(point, 20);
    if (index > 0 && index <= 30) {
      return content.substring(0, index + 1);
    }
  }
  
  // If no good break point, just truncate
  return content.substring(0, 30) + '...';
};