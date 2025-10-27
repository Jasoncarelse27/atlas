import { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { logger } from '../lib/logger';
import type { Tier } from '../types/tier';

export type UpgradeTrigger = 'message_limit' | 'voice_feature' | 'image_feature' | 'general';

interface UseUpgradeFlowReturn {
  showUpgradeModal: boolean;
  triggerReason: UpgradeTrigger | undefined;
  openUpgradeModal: (reason: UpgradeTrigger) => void;
  closeUpgradeModal: () => void;
  handleUpgrade: (tier: 'core' | 'studio') => Promise<void>;
}

export function useUpgradeFlow(): UseUpgradeFlowReturn {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [triggerReason, setTriggerReason] = useState<UpgradeTrigger | undefined>();

  const openUpgradeModal = useCallback((reason: UpgradeTrigger) => {
    setTriggerReason(reason);
    setShowUpgradeModal(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setShowUpgradeModal(false);
    setTriggerReason(undefined);
  }, []);

  const handleUpgrade = useCallback(async (tier: 'core' | 'studio') => {
    // Close modal first
    closeUpgradeModal();
    
    try {
      // Show loading toast
      const loadingToast = toast.loading('Opening secure checkout...');
      
      // ✅ BEST PRACTICE: Dynamic import to avoid circular dependencies
      const { fastspringService } = await import('../services/fastspringService');
      const { useSupabaseAuth } = await import('./useSupabaseAuth');
      
      // Get user info from hook
      const { user } = useSupabaseAuth();
      if (!user?.id || !user?.email) {
        toast.dismiss(loadingToast);
        toast.error('Please log in to upgrade');
        return;
      }
      
      // Create checkout URL
      const checkoutUrl = await fastspringService.createCheckoutUrl(user.id, tier, user.email);
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // ✅ BEST PRACTICE: Log for debugging
      logger.info('Redirecting to FastSpring checkout:', checkoutUrl);
      
      // Track upgrade attempt
      ConversionAnalytics.trackUpgradeAttempt(tier, triggerReason || 'general');
      
      // Redirect to FastSpring checkout
      window.location.href = checkoutUrl;
      
    } catch (error) {
      logger.error('Upgrade error:', error);
      
      // ✅ BEST PRACTICE: User-friendly error with actionable guidance
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(
        `${errorMessage}\n\nPlease contact support if this persists.`,
        { duration: 5000 }
      );
    }
  }, [triggerReason, closeUpgradeModal]);

  return {
    showUpgradeModal,
    triggerReason,
    openUpgradeModal,
    closeUpgradeModal,
    handleUpgrade
  };
}

// Conversion funnel analytics
export class ConversionAnalytics {
  static trackUpgradeTrigger(_trigger: UpgradeTrigger, _currentTier: Tier) {
    // Track when users hit upgrade triggers
    
    // Analytics integration will be implemented
    // analytics.track('upgrade_trigger', {
    //   trigger: _trigger,
    //   current_tier: _currentTier,
    //   timestamp: new Date().toISOString()
    // });
  }

  static trackUpgradeAttempt(_targetTier: 'core' | 'studio', _trigger: UpgradeTrigger) {
    // Track when users attempt to upgrade
    
    // Analytics integration will be implemented
    // analytics.track('upgrade_attempt', {
    //   target_tier: _targetTier,
    //   trigger: _trigger,
    //   timestamp: new Date().toISOString()
    // });
  }

  static trackUpgradeSuccess(_targetTier: 'core' | 'studio', _trigger: UpgradeTrigger) {
    // Track successful upgrades
    
    // Analytics integration will be implemented
    // analytics.track('upgrade_success', {
    //   target_tier: _targetTier,
    //   trigger: _trigger,
    //   timestamp: new Date().toISOString()
    // });
  }
}
