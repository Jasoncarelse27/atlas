import { v4 as uuidv4 } from 'uuid';

export interface Attachment {
  type: "image" | "audio" | "file";
  url: string;
  progress?: number;       // upload % (0–100)
  failed?: boolean;        // mark failed uploads
  file?: File;            // original file for retry
  caption?: string;        // user-added caption for the attachment
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type?: 'text' | 'image' | 'audio' | 'file' | 'mixed' | 'system' | 'attachment';
  content?: string;                // legacy single text/image/audio
  attachments?: Attachment[];      // ✅ new: multiple files
  timestamp: string;
  error?: string | boolean; // Support both string error messages and boolean upload failure
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'pending' | 'error' | 'uploading' | 'done';
  deliveredAt?: string; // ✅ NEW: When message was delivered to recipient
  readAt?: string; // ✅ NEW: When message was read by recipient
  deletedAt?: string; // ✅ PHASE 2: When message was soft deleted
  deletedBy?: 'user' | 'everyone'; // ✅ PHASE 2: Who can't see the message
  audioUrl?: string;
  imageUrl?: string;
  // Extended file support
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
    // Upload state management
    url?: string; // final uploaded URL
    localPreview?: string; // blob URL for preview
    uploading?: boolean; // true while uploading
    uploadProgress?: number; // upload progress percentage (0-100)
    uploadError?: boolean; // true if upload failed
    fileName?: string; // sanitized filename
    mimeType?: string; // file MIME type
    file?: File; // Store raw File for retry functionality
    caption?: string; // user-added caption for the attachment
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
    : firstUserMessage.content || '';
  
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