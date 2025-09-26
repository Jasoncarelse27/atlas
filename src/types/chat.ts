import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | string[]; // Support multiple images as array
  timestamp: string;
  error?: string | boolean; // Support both string error messages and boolean upload failure
  status?: 'sending' | 'sent' | 'failed' | 'pending' | 'error' | 'uploading' | 'done';
  audioUrl?: string;
  imageUrl?: string;
  // Extended file support
  type?: 'text' | 'image' | 'audio' | 'file' | 'system';
  url?: string; // for uploaded files
  // Upload state management
  localUrl?: string; // blob URL for instant preview
  uploading?: boolean; // true while uploading
  progress?: number; // upload progress percentage (0-100)
  localFile?: File; // Store original file for retry
  metadata?: {
    filename?: string;
    size?: number;
    duration?: number; // for audio
    dimensions?: { width: number; height: number }; // for images
    transcript?: string; // for audio
  };
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
  
  // Get content as string (handle both string and array)
  const content = Array.isArray(firstUserMessage.content) 
    ? firstUserMessage.content.join(' ') 
    : firstUserMessage.content;
  
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