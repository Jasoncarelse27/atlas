import { Tier, tierFeatures } from '../utils/featureAccess';

export function useTierAccess(userTier: Tier) {
  const features = tierFeatures[userTier] ?? tierFeatures['free'];

  function canUse(feature: keyof typeof features) {
    return Boolean(features[feature]);
  }

  function getLimit(limit: keyof NonNullable<typeof features.limits>) {
    return features.limits?.[limit];
  }

  function isUnlimited(limit: keyof NonNullable<typeof features.limits>) {
    const limitValue = features.limits?.[limit];
    return limitValue === -1;
  }

  function getRemainingUsage(currentUsage: number, limit: keyof NonNullable<typeof features.limits>) {
    const limitValue = features.limits?.[limit];
    if (limitValue === -1) return 'Unlimited';
    return Math.max(0, limitValue - currentUsage);
  }

  return { 
    canUse, 
    getLimit, 
    isUnlimited,
    getRemainingUsage,
    features 
  };
}
