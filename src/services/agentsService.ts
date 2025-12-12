// Atlas Agents API Client
// Agents Dashboard - Frontend API Client
// Handles notifications, business notes, and business chat

import { logger } from '../lib/logger';
import { getApiEndpoint } from '../utils/apiClient';
import { fetchWithAuthJSON } from './fetchWithAuth';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

export interface BusinessNote {
  id: string;
  user_id: string;
  content: string;
  source: string;
  created_at: string;
}

export interface BusinessChatResponse {
  reply: string;
  summary: string;
}

/**
 * Fetch user notifications
 */
export async function getNotifications(): Promise<Notification[]> {
  try {
    const endpoint = getApiEndpoint('/api/notifications');
    const data = await fetchWithAuthJSON(endpoint) as { notifications: Notification[] };
    
    logger.debug('[AgentsAPI] Fetched notifications:', {
      count: data.notifications?.length || 0
    });
    
    return data.notifications || [];
  } catch (error) {
    logger.error('[AgentsAPI] Failed to fetch notifications:', error);
    throw new Error('Failed to fetch notifications. Please try again.');
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
  try {
    const endpoint = getApiEndpoint('/api/notifications/mark-read');
    const data = await fetchWithAuthJSON(endpoint, {
      method: 'POST',
      body: JSON.stringify({ notificationId })
    }) as { success: boolean };
    
    logger.debug('[AgentsAPI] Marked notification as read:', { notificationId });
    
    return data;
  } catch (error) {
    logger.error('[AgentsAPI] Failed to mark notification as read:', error);
    throw new Error('Failed to mark notification as read. Please try again.');
  }
}

/**
 * Fetch business notes
 */
export async function getBusinessNotes(): Promise<BusinessNote[]> {
  try {
    const endpoint = getApiEndpoint('/api/business-notes');
    const data = await fetchWithAuthJSON(endpoint) as { notes: BusinessNote[] };
    
    logger.debug('[AgentsAPI] Fetched business notes:', {
      count: data.notes?.length || 0
    });
    
    return data.notes || [];
  } catch (error) {
    logger.error('[AgentsAPI] Failed to fetch business notes:', error);
    throw new Error('Failed to fetch business notes. Please try again.');
  }
}

/**
 * Create a new business note
 */
export async function createBusinessNote(content: string): Promise<BusinessNote> {
  try {
    const endpoint = getApiEndpoint('/api/business-notes');
    const data = await fetchWithAuthJSON(endpoint, {
      method: 'POST',
      body: JSON.stringify({ content })
    }) as { note: BusinessNote };
    
    logger.debug('[AgentsAPI] Created business note:', { noteId: data.note?.id });
    
    return data.note;
  } catch (error) {
    logger.error('[AgentsAPI] Failed to create business note:', error);
    throw new Error('Failed to create business note. Please try again.');
  }
}

/**
 * Send message to business chat (memory-aware LLM)
 */
export async function businessChat(content: string): Promise<BusinessChatResponse> {
  try {
    const endpoint = getApiEndpoint('/api/business-chat');
    const data = await fetchWithAuthJSON(endpoint, {
      method: 'POST',
      body: JSON.stringify({ content })
    }) as BusinessChatResponse;
    
    logger.debug('[AgentsAPI] Business chat response generated');
    
    return data;
  } catch (error) {
    logger.error('[AgentsAPI] Failed to generate business chat response:', error);
    throw new Error('Failed to generate business chat response. Please try again.');
  }
}

export interface EmailFetchResponse {
  ok: boolean;
  processed: number;
  threads: Array<{
    threadId: string;
    subject: string;
    classification: string;
    critical: boolean;
    incidentId: string | null;
  }>;
  error?: string;
}

/**
 * Fetch emails from Gmail via Email Agent
 * @param mailbox - 'info' | 'jason' | 'rima'
 * @param since - Optional ISO date string to fetch emails since this date
 */
export async function fetchEmails(mailbox: 'info' | 'jason' | 'rima' = 'jason', since?: string): Promise<EmailFetchResponse> {
  try {
    const endpoint = getApiEndpoint('/api/agents/email/fetch');
    const body: { mailbox: string; since?: string } = { mailbox };
    if (since) {
      body.since = since;
    }
    
    const data = await fetchWithAuthJSON(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    }) as EmailFetchResponse;
    
    logger.debug('[AgentsAPI] Fetched emails:', {
      processed: data.processed,
      threads: data.threads?.length || 0
    });
    
    return data;
  } catch (error) {
    logger.error('[AgentsAPI] Failed to fetch emails:', error);
    throw new Error('Failed to fetch emails. Please try again.');
  }
}

