// backend/services/notificationService.mjs

import { logger } from '../lib/simpleLogger.mjs';

/**
 * 🔔 MagicBell Notification Service
 * Sends in-app notifications via MagicBell API
 */
class NotificationService {
  constructor() {
    this.apiKey = process.env.MAGICBELL_API_KEY || process.env.VITE_MAGICBELL_API_KEY;
    this.apiUrl = 'https://api.magicbell.com';
  }

  /**
   * Check if MagicBell is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Send notification to user
   * @param {string} userId - User's external_id (Supabase user ID)
   * @param {object} notification - Notification data
   * @param {string} notification.title - Notification title
   * @param {string} notification.content - Notification content
   * @param {string} [notification.category] - Category (e.g., 'subscription', 'feature', 'system')
   * @param {string} [notification.actionUrl] - URL to navigate on click
   * @param {object} [notification.customAttributes] - Custom data
   */
  async sendNotification(userId, { title, content, category = 'system', actionUrl, customAttributes = {} }) {
    if (!this.isConfigured()) {
      logger.debug('[NotificationService] MagicBell not configured - skipping notification');
      return { success: false, reason: 'not_configured' };
    }

    if (!userId) {
      logger.warn('[NotificationService] Missing userId - cannot send notification');
      return { success: false, reason: 'missing_user_id' };
    }

    try {
      const payload = {
        recipients: [
          {
            external_id: userId,
          },
        ],
        title,
        content,
        category,
        ...(actionUrl && { action_url: actionUrl }),
        ...(Object.keys(customAttributes).length > 0 && { custom_attributes: customAttributes }),
      };

      const response = await fetch(`${this.apiUrl}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MAGICBELL-API-KEY': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.error('[NotificationService] Failed to send notification:', {
          userId,
          status: response.status,
          error: errorText,
        });
        return { success: false, reason: 'api_error', status: response.status };
      }

      const data = await response.json().catch(() => ({}));
      logger.debug('[NotificationService] ✅ Notification sent successfully:', { userId, title });
      return { success: true, data };
    } catch (error) {
      logger.error('[NotificationService] Error sending notification:', error);
      return { success: false, reason: 'exception', error: error.message };
    }
  }

  /**
   * Send subscription upgrade notification
   */
  async sendUpgradeNotification(userId, newTier) {
    const tierNames = {
      core: 'Atlas Core',
      studio: 'Atlas Studio',
    };

    return this.sendNotification(userId, {
      title: `Welcome to ${tierNames[newTier] || newTier}! 🎉`,
      content: `Your subscription is now active. Enjoy unlimited messages and premium features!`,
      category: 'subscription',
      actionUrl: '/chat',
      customAttributes: {
        tier: newTier,
        event_type: 'upgrade',
      },
    });
  }

  /**
   * Send subscription cancellation notification
   */
  async sendCancellationNotification(userId, tier) {
    return this.sendNotification(userId, {
      title: 'Subscription Cancelled',
      content: `Your ${tier} subscription has been cancelled. You'll retain access until the end of your billing period.`,
      category: 'subscription',
      actionUrl: '/upgrade',
      customAttributes: {
        tier,
        event_type: 'cancellation',
      },
    });
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedNotification(userId) {
    return this.sendNotification(userId, {
      title: 'Payment Issue ⚠️',
      content: 'We couldn\'t process your payment. Please update your payment method to continue using Atlas.',
      category: 'subscription',
      actionUrl: '/upgrade',
      customAttributes: {
        event_type: 'payment_failed',
      },
    });
  }

  /**
   * Send welcome notification
   */
  async sendWelcomeNotification(userId) {
    return this.sendNotification(userId, {
      title: 'Welcome to Atlas! 🌱',
      content: 'Your emotionally intelligent productivity assistant is ready. Start a conversation to begin!',
      category: 'system',
      actionUrl: '/chat',
      customAttributes: {
        event_type: 'welcome',
      },
    });
  }
}

export const notificationService = new NotificationService();


