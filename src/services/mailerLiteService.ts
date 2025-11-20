/**
 * MailerLite Service
 * Handles subscriber management, events, and group segmentation
 */

import { logger } from '../lib/logger';

export type MailerLiteEvent = 
  | 'user_signup'
  | 'first_message'
  | 'first_conversation'
  | 'tier_upgrade'
  | 'tier_downgrade'
  | 'monthly_limit_reached'
  | 'conversation_limit_reached'
  | 'feature_usage_milestone'
  | 'onboarding_complete'
  | 'subscription_cancelled'
  | 'subscription_reactivated';

export interface SubscriberData {
  email: string;
  name?: string;
  tier: 'free' | 'core' | 'studio' | 'complete';
  conversations_today?: number;
  total_conversations?: number;
  last_active?: string;
  signup_date?: string;
  subscription_status?: 'active' | 'cancelled' | 'past_due';
  custom_fields?: Record<string, any>;
}

interface TriggerEventParams {
  email: string;
  event: MailerLiteEvent;
  properties?: Record<string, any>;
}

class MailerLiteService {
  private apiKey: string | null = null;
  private apiUrl = 'https://api.mailerlite.com/api/v2';

  constructor() {
    // Get API key from environment (works in both Node.js and browser via Vite)
    this.apiKey = import.meta.env.VITE_MAILERLITE_API_KEY || 
                  (typeof process !== 'undefined' && process.env?.MAILERLITE_API_KEY) ||
                  null;
  }

  /**
   * Check if MailerLite is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== '__PENDING__';
  }

  /**
   * Create or update subscriber
   */
  async createOrUpdateSubscriber(data: SubscriberData): Promise<void> {
    if (!this.isConfigured()) {
      logger.debug('[MailerLite] Not configured - skipping subscriber sync');
      return;
    }

    try {
      const subscriberData = {
        email: data.email,
        name: data.name || '',
        fields: {
          tier: data.tier || 'free',
          conversations_today: data.conversations_today || 0,
          total_conversations: data.total_conversations || 0,
          last_active: data.last_active || new Date().toISOString(),
          signup_date: data.signup_date || new Date().toISOString(),
          subscription_status: data.subscription_status || 'active',
          ...data.custom_fields,
        },
        resubscribe: true,
      };

      const response = await this.fetchWithRetry(
        `${this.apiUrl}/subscribers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MailerLite-ApiKey': this.apiKey!,
          },
          body: JSON.stringify(subscriberData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`MailerLite API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      logger.debug(`[MailerLite] ✅ Subscriber ${data.email} synced successfully`);
    } catch (error) {
      logger.error('[MailerLite] Failed to sync subscriber:', error);
      // Don't throw - MailerLite failures shouldn't break the app
    }
  }

  /**
   * Update custom fields for subscriber
   */
  async updateCustomFields(email: string, fields: Record<string, any>): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      const response = await this.fetchWithRetry(
        `${this.apiUrl}/subscribers/${encodeURIComponent(email)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-MailerLite-ApiKey': this.apiKey!,
          },
          body: JSON.stringify({
            fields,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`MailerLite API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      logger.debug(`[MailerLite] ✅ Custom fields updated for ${email}`);
    } catch (error) {
      logger.error('[MailerLite] Failed to update custom fields:', error);
      // Don't throw - MailerLite failures shouldn't break the app
    }
  }

  /**
   * Trigger event for subscriber
   */
  async triggerEvent(params: TriggerEventParams): Promise<void> {
    if (!this.isConfigured()) {
      logger.debug('[MailerLite] Not configured - skipping event trigger');
      return;
    }

    try {
      // MailerLite v2 API uses webhooks for events, but we can also use custom fields
      // For now, we'll update custom fields with event data
      await this.updateCustomFields(params.email, {
        last_event: params.event,
        last_event_time: new Date().toISOString(),
        ...params.properties,
      });

      logger.debug(`[MailerLite] ✅ Event ${params.event} triggered for ${params.email}`);
    } catch (error) {
      logger.error('[MailerLite] Failed to trigger event:', error);
      // Don't throw - MailerLite failures shouldn't break the app
    }
  }

  /**
   * Add subscriber to group
   */
  async segmentSubscriber(email: string, groupName: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      // First, get group ID by name (or use group name directly if API supports it)
      // For now, we'll use a simplified approach
      const response = await this.fetchWithRetry(
        `${this.apiUrl}/groups/${encodeURIComponent(groupName)}/subscribers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MailerLite-ApiKey': this.apiKey!,
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // If group doesn't exist, that's okay - log and continue
        if (response.status !== 404) {
          throw new Error(`MailerLite API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }
      }

      logger.debug(`[MailerLite] ✅ Added ${email} to group ${groupName}`);
    } catch (error) {
      logger.error('[MailerLite] Failed to add subscriber to group:', error);
      // Don't throw - MailerLite failures shouldn't break the app
    }
  }

  /**
   * Remove subscriber from group
   */
  async removeFromGroup(email: string, groupName: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      const response = await this.fetchWithRetry(
        `${this.apiUrl}/groups/${encodeURIComponent(groupName)}/subscribers/${encodeURIComponent(email)}`,
        {
          method: 'DELETE',
          headers: {
            'X-MailerLite-ApiKey': this.apiKey!,
          },
        }
      );

      if (!response.ok && response.status !== 404) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`MailerLite API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      logger.debug(`[MailerLite] ✅ Removed ${email} from group ${groupName}`);
    } catch (error) {
      logger.error('[MailerLite] Failed to remove subscriber from group:', error);
      // Don't throw - MailerLite failures shouldn't break the app
    }
  }

  /**
   * Fetch with retry logic (3 attempts with exponential backoff)
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // If successful or client error (4xx), don't retry
        if (response.ok || response.status >= 400 && response.status < 500) {
          return response;
        }

        // Server error (5xx) - retry
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    throw lastError || new Error('Fetch failed after retries');
  }
}

export const mailerLiteService = new MailerLiteService();

