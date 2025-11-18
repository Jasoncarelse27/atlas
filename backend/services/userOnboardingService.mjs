// backend/services/userOnboardingService.mjs

import { notificationService } from './notificationService.mjs';
import { logger } from '../lib/simpleLogger.mjs';

/**
 * Send welcome notification to new users
 */
export async function sendWelcomeNotification(userId) {
  if (!userId) {
    logger.debug('[UserOnboarding] Missing userId - skipping welcome notification');
    return;
  }

  try {
    await notificationService.sendWelcomeNotification(userId);
    logger.debug('[UserOnboarding] ✅ Welcome notification sent:', userId);
  } catch (error) {
    logger.error('[UserOnboarding] Failed to send welcome notification:', error);
    // Don't throw - welcome notification failure shouldn't break signup
  }
}




