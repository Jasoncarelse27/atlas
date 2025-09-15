import { useCallback, useState } from 'react';
import { Tier } from '../config/featureAccess';

export type UpgradeTrigger = 'message_limit' | 'voice_feature' | 'image_feature' | 'general';

interface UseUpgradeFlowReturn {
  showUpgradeModal: boolean;
  triggerReason: UpgradeTrigger | undefined;
  openUpgradeModal: (reason: UpgradeTrigger) => void;
  closeUpgradeModal: () => void;
  handleUpgrade: (tier: 'core' | 'studio') => void;
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

  const handleUpgrade = useCallback((tier: 'core' | 'studio') => {
    // Close modal first
    closeUpgradeModal();
    
    // Track upgrade event
    console.log(`User upgrading to ${tier}`, { triggerReason });
    
    // Here you would integrate with your payment system
    // For now, we'll just show an alert
    alert(`Redirecting to payment for Atlas ${tier === 'core' ? 'Core' : 'Studio'}...`);
    
    // TODO: Integrate with Stripe/PayPal payment flow
    // window.location.href = `/upgrade?tier=${tier}&reason=${triggerReason}`;
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
  static trackUpgradeTrigger(trigger: UpgradeTrigger, currentTier: Tier) {
    // Track when users hit upgrade triggers
    console.log('Upgrade trigger:', { trigger, currentTier, timestamp: new Date().toISOString() });
    
    // TODO: Send to analytics service (Mixpanel, Amplitude, etc.)
    // analytics.track('upgrade_trigger', {
    //   trigger,
    //   current_tier: currentTier,
    //   timestamp: new Date().toISOString()
    // });
  }

  static trackUpgradeAttempt(targetTier: 'core' | 'studio', trigger: UpgradeTrigger) {
    // Track when users attempt to upgrade
    console.log('Upgrade attempt:', { targetTier, trigger, timestamp: new Date().toISOString() });
    
    // TODO: Send to analytics service
    // analytics.track('upgrade_attempt', {
    //   target_tier: targetTier,
    //   trigger,
    //   timestamp: new Date().toISOString()
    // });
  }

  static trackUpgradeSuccess(targetTier: 'core' | 'studio', trigger: UpgradeTrigger) {
    // Track successful upgrades
    console.log('Upgrade success:', { targetTier, trigger, timestamp: new Date().toISOString() });
    
    // TODO: Send to analytics service
    // analytics.track('upgrade_success', {
    //   target_tier: targetTier,
    //   trigger,
    //   timestamp: new Date().toISOString()
    // });
  }
}
