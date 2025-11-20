// src/utils/handleLaunchUrl.ts
// Deep link handling for email → Atlas navigation
// Handles conversation deep links, FastSpring return URLs, and MailerLite unsubscribe links

import type { NavigateFunction } from 'react-router-dom';
import { logger } from '../lib/logger';

export interface LaunchUrlContext {
  navigate: NavigateFunction;
  refreshTier?: () => void;
}

/**
 * Handle deep links and URL parameters on app launch
 * 
 * Supported parameters:
 * - conversationId, conversation, cId → Navigate to chat with conversation
 * - fs_order_id, orderId → Navigate to billing and refresh tier
 * 
 * Safe and idempotent - can be called multiple times without side effects
 */
export function handleLaunchUrl(ctx: LaunchUrlContext): void {
  const { navigate, refreshTier } = ctx;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    // 1) Conversation deep links
    // ChatPage expects 'conversation' param, but we support multiple variants for flexibility
    const conversationId =
      params.get('conversationId') ||
      params.get('conversation') ||
      params.get('cId');

    if (conversationId) {
      logger.debug(`[DeepLink] Conversation deep link detected: ${conversationId}`);
      // Navigate to chat page - ChatPage reads 'conversation' param from searchParams
      navigate(`/chat?conversation=${conversationId}`, { replace: true });
      
      // Clean up URL after navigation (remove all variants)
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('conversationId');
      cleanUrl.searchParams.delete('conversation');
      cleanUrl.searchParams.delete('cId');
      window.history.replaceState({}, '', cleanUrl.toString());
      return;
    }

    // 2) FastSpring return URLs (e.g. ?fs_order_id=123)
    const fsOrderId = params.get('fs_order_id') || params.get('orderId');
    if (fsOrderId) {
      logger.debug(`[DeepLink] FastSpring order detected: ${fsOrderId}`);
      
      // Navigate user to billing/subscription screen
      navigate('/billing', { replace: true });

      // Trigger tier refresh if available (ensures tier is up-to-date after purchase)
      if (refreshTier) {
        // Small delay to ensure navigation completes first
        setTimeout(() => {
          refreshTier();
        }, 500);
      }

      // Clean up URL after navigation
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('fs_order_id');
      cleanUrl.searchParams.delete('orderId');
      window.history.replaceState({}, '', cleanUrl.toString());
      return;
    }

    // 3) Fallback: nothing special to handle
    // URL is clean, no action needed
  } catch (error) {
    // Silent fail - don't break app if URL parsing fails
    logger.debug('[DeepLink] Error handling launch URL:', error);
  }
}

