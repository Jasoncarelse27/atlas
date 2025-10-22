/**
 * Feature Flags - Safe Rollout Control
 * Enable/disable features without code changes
 */

export const FEATURE_FLAGS = {
  // Voice call streaming (sentence-by-sentence progressive audio)
  VOICE_STREAMING: import.meta.env.VITE_VOICE_STREAMING_ENABLED === 'true',
  
  // Beta testing mode (for select users)
  VOICE_STREAMING_BETA: import.meta.env.VITE_VOICE_STREAMING_BETA === 'true',
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature is enabled
 */
export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  return FEATURE_FLAGS[flag] || false;
};

/**
 * Log feature flag status (for debugging)
 */
export const logFeatureFlags = (): void => {
  console.log('[FeatureFlags] Current configuration:', FEATURE_FLAGS);
};

