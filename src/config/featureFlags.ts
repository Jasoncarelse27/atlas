/**
 * Feature Flags Configuration
 * Controls gradual rollout of new features
 */

export const FEATURE_FLAGS = {
  VOICE_STREAMING: import.meta.env.VITE_VOICE_STREAMING_ENABLED === 'true',
};

export const isFeatureEnabled = (flag: keyof typeof FEATURE_FLAGS): boolean => {
  return FEATURE_FLAGS[flag];
};

