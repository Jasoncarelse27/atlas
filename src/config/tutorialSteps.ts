/**
 * Tutorial Steps Configuration
 * Defines tutorial steps with mobile/desktop positioning
 * Tier-aware: respects subscription tier for feature visibility
 */

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: {
    desktop: 'top' | 'bottom' | 'left' | 'right' | 'center';
    mobile: 'top' | 'bottom' | 'left' | 'right' | 'center';
  };
  offset?: {
    desktop?: { x?: number; y?: number };
    mobile?: { x?: number; y?: number };
  };
  tierAware?: boolean; // Only show if user has access to feature
  requiredTier?: 'core' | 'studio'; // Minimum tier required
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Atlas!',
    description: "Emotionally intelligent productivity assistant is ready. Let's get you started.",
    targetSelector: 'body', // Full screen - centered on mobile
    position: {
      desktop: 'bottom',
      mobile: 'center' // ✅ MOBILE FIX: Center on mobile for professional UX
    },
    offset: {
      desktop: { y: 20 },
      mobile: { y: 0 } // No offset when centered
    }
  },
  {
    id: 'chat-interface',
    title: 'Start a Conversation',
    description: 'Type your message here. Atlas understands emotions and provides personalized coaching to help you grow.',
    targetSelector: '[role="log"]', // Message area
    position: {
      desktop: 'center',
      mobile: 'center'
    }
  },
  {
    id: 'sidebar-features',
    title: 'Access Your Features',
    description: 'Open the menu to access your conversation history, rituals, settings, and more.',
    targetSelector: 'button[aria-label*="menu" i], button:has(svg[class*="Menu"])', // Menu button
    position: {
      desktop: 'right',
      mobile: 'center' // ✅ FIX: Center on mobile for professional UX
    },
    offset: {
      desktop: { x: 10 },
      mobile: { y: 0 } // No offset when centered
    }
  },
  {
    id: 'voice-image-features',
    title: 'Voice & Image Features',
    description: 'Upgrade to Core or Studio to use voice calls and image analysis for richer conversations.',
    targetSelector: 'button[aria-label*="attachment" i], button:has(svg[class*="Paperclip"])', // Attachment button
    position: {
      desktop: 'top',
      mobile: 'top'
    },
    offset: {
      desktop: { y: -10 },
      mobile: { y: -10 }
    },
    tierAware: true,
    requiredTier: 'core' // Only show if user can't access these features
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description: 'Start chatting with Atlas to begin your journey toward greater emotional intelligence and productivity.',
    targetSelector: 'body', // Full screen
    position: {
      desktop: 'center',
      mobile: 'center'
    }
  }
];

/**
 * Get tutorial steps filtered by tier
 * Removes tier-aware steps if user already has access
 */
export function getTutorialStepsForTier(tier: 'free' | 'core' | 'studio'): TutorialStep[] {
  return TUTORIAL_STEPS.filter(step => {
    // If step is tier-aware and user has required tier, skip it
    if (step.tierAware && step.requiredTier) {
      const tierLevels = { free: 0, core: 1, studio: 2 };
      const userTierLevel = tierLevels[tier];
      const requiredTierLevel = tierLevels[step.requiredTier];
      
      // Skip if user already has access to the feature
      if (userTierLevel >= requiredTierLevel) {
        return false;
      }
    }
    return true;
  });
}

