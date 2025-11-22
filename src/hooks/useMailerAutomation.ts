// src/hooks/useMailerAutomation.ts
// Silent MailerLite automation hook - runs without rendering UI
// Extracted from MailerLiteIntegration component for production use

import { useEffect, useRef } from 'react';
import { useMailer, useMailerEvents } from './useMailer';
import { logger } from '../lib/logger';

interface UseMailerAutomationConfig {
  userEmail: string;
  userName?: string;
  userTier: 'free' | 'core' | 'studio' | 'complete';
  conversationsToday: number;
  totalConversations: number;
}

/**
 * Silent MailerLite automation hook
 * Automatically syncs user data and triggers events without rendering UI
 * 
 * This hook extracts the automation logic from MailerLiteIntegration component
 * to enable MailerLite features for all users without showing debug/admin UI
 */
export function useMailerAutomation(config: UseMailerAutomationConfig) {
  const { userEmail, userName, userTier, conversationsToday, totalConversations } = config;

  // Main MailerLite hook for subscriber management
  const {
    isConfigured,
    updateUsage,
    triggerEvent,
    addToGroup,
  } = useMailer({
    email: userEmail,
    name: userName,
    tier: userTier,
    autoSync: true,
    onError: (error) => {
      // Silent error handling - don't show to users
      logger.debug('[MailerLite] Automation error:', error);
    },
    onSuccess: (operation) => {
      // Silent success logging
      logger.debug('[MailerLite] Automation success:', operation);
    },
  });

  // Simple event trigger hook for one-off events
  const { triggerEvent: triggerSimpleEvent } = useMailerEvents(userEmail);

  // ✅ IDEMPOTENCY FIX: Track sent events to prevent duplicates
  const limitEventSentRef = useRef(false);
  const milestoneEventSentRef = useRef<Set<number>>(new Set());
  const signupEventSentRef = useRef(false);

  // ✅ FIX: Debounced usage updates to prevent API spam
  // Only update when values actually change meaningfully
  const lastUpdateRef = useRef({ conversationsToday: -1, totalConversations: -1 });
  
  useEffect(() => {
    // Only update if configured and values have actually changed
    if (isConfigured && userEmail) {
      const hasChanged = 
        conversationsToday !== lastUpdateRef.current.conversationsToday ||
        totalConversations !== lastUpdateRef.current.totalConversations;
      
      if (hasChanged) {
        lastUpdateRef.current = { conversationsToday, totalConversations };
        
        // Debounce the update by 5 seconds to batch rapid changes
        const timeoutId = setTimeout(() => {
          updateUsage(conversationsToday, totalConversations).catch(() => {
            // Silent fail - non-critical
            logger.debug('[MailerLite] Failed to update usage (non-critical)');
          });
        }, 5000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [isConfigured, userEmail, conversationsToday, totalConversations, updateUsage]);

  // Auto-trigger conversation limit event for free tier (with idempotency)
  useEffect(() => {
    if (isConfigured && userEmail && userTier === 'free' && conversationsToday >= 2 && !limitEventSentRef.current) {
      limitEventSentRef.current = true;
      
      // Add to upgrade-ready group
      addToGroup('atlas_upgrade_ready').catch(() => {
        // Silent fail - non-critical
      });
      
      // Trigger limit reached event
      triggerEvent('conversation_limit_reached', {
        conversations_today: conversationsToday,
        tier_limit: 2,
        user_tier: userTier,
      }).catch(() => {
        // Reset on error so it can retry
        limitEventSentRef.current = false;
      });
    }
    // Reset flag if user drops below limit (allows re-triggering if needed)
    if (conversationsToday < 2) {
      limitEventSentRef.current = false;
    }
  }, [isConfigured, userEmail, userTier, conversationsToday, triggerEvent, addToGroup]);

  // Auto-trigger first conversation event
  useEffect(() => {
    if (isConfigured && userEmail && totalConversations === 1) {
      triggerEvent('first_conversation', {
        total_conversations: totalConversations,
        user_tier: userTier,
      }).catch(() => {
        // Silent fail - non-critical
      });
    }
  }, [isConfigured, userEmail, totalConversations, userTier, triggerEvent]);

  // Auto-trigger milestone events (with idempotency)
  useEffect(() => {
    if (isConfigured && userEmail && totalConversations > 0 && totalConversations % 10 === 0) {
      const milestone = totalConversations;
      // Only trigger if we haven't sent this milestone yet
      if (!milestoneEventSentRef.current.has(milestone)) {
        milestoneEventSentRef.current.add(milestone);
        triggerEvent('feature_usage_milestone', {
          milestone: milestone,
          conversations_today: conversationsToday,
          user_tier: userTier,
        }).catch(() => {
          // Remove on error so it can retry
          milestoneEventSentRef.current.delete(milestone);
        });
      }
    }
  }, [isConfigured, userEmail, totalConversations, conversationsToday, userTier, triggerEvent]);

  // Auto-trigger signup event (only once per session)
  useEffect(() => {
    if (isConfigured && userEmail && !signupEventSentRef.current) {
      const hasTriggeredSignup = sessionStorage.getItem(`mailer_signup_${userEmail}`);
      if (!hasTriggeredSignup) {
        signupEventSentRef.current = true;
        triggerSimpleEvent('user_signup', {
          tier: userTier,
          signup_date: new Date().toISOString(),
        }).catch(() => {
          // Reset on error so it can retry
          signupEventSentRef.current = false;
        });
        sessionStorage.setItem(`mailer_signup_${userEmail}`, 'true');
      }
    }
  }, [isConfigured, userEmail, userTier, triggerSimpleEvent]);
}

