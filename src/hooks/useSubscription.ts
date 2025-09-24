import type { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { UsageCheck, UserProfile } from '../types/subscription';
import { TIER_CONFIGS } from '../types/subscription';

interface UseSubscriptionReturn {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  checkUsageLimit: (actionType: string) => Promise<UsageCheck>;
  updateUsage: (actionType: string, amount?: number) => Promise<void>;
  refreshProfile: () => Promise<void>;
  getDaysRemaining: () => number | null;
  isTrialExpired: () => boolean;
  canAccessFeature: (feature: string) => boolean;
  getUsagePercentage: (type: 'mood_tracking' | 'emotional_insights' | 'journal_entries' | 'ai_prompts') => number;
  updateSubscriptionTier: (tier: string) => Promise<void>;
}

export const useSubscription = (user: User | null): UseSubscriptionReturn => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ FUTURE-PROOF: Keep last known valid profile to prevent null flicker
  const [lastValidProfile, setLastValidProfile] = useState<UserProfile | null>(null);

  const createDefaultProfile = (userId: string): UserProfile => {
    return {
      id: userId,
      tier: 'free',
      trial_ends_at: null,
      subscription_status: 'active',
      subscription_id: null,
      usage_stats: {
        mood_tracking_days: 0,
        emotional_insights_this_month: 0,
        journal_entries_this_month: 0,
        ai_prompts_this_month: 0,
        streak_days: 0,
        last_reset_date: null
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  };

  // ✅ GOLDEN STANDARD: Backend-first refresh with Dexie fallback
  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLastValidProfile(null);
      setIsLoading(false);
      return;
    }

    console.log('📊 Refreshing profile...');
    setIsLoading(true);
    setError(null);

    try {
      // 1. Backend first - fetch from Supabase
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // ✅ Normalize subscription_tier → tier
      const normalizedProfile: UserProfile = {
        ...data,
        tier: data.subscription_tier || data.tier || 'free',
      };

      // 2. Update React state
      setProfile(normalizedProfile);
      setLastValidProfile(normalizedProfile);

      // 3. Sync to Dexie cache
      try {
        if (window.db?.profiles) {
          await window.db.profiles.put(normalizedProfile);
          console.log('✅ Profile synced from backend to Dexie');
        }
      } catch (dexieError) {
        console.warn('⚠️ Dexie sync failed (non-critical):', dexieError);
      }

      console.log('✅ Profile synced from backend');

    } catch (err) {
      console.warn('⚠️ Backend unavailable, falling back to Dexie');
      
      // 4. Fallback to Dexie if backend is unavailable
      try {
        if (window.db?.profiles) {
          const cached = await window.db.profiles.get(user.id);
          if (cached) {
            setProfile(cached);
            setLastValidProfile(cached);
            console.log('✅ Profile loaded from Dexie cache');
          } else {
            // No cached data, use default
            const defaultProfile = createDefaultProfile(user.id);
            setProfile(defaultProfile);
            setLastValidProfile(defaultProfile);
            console.log('✅ Using default profile (no cache)');
          }
        } else {
          // No Dexie available, use default
          const defaultProfile = createDefaultProfile(user.id);
          setProfile(defaultProfile);
          setLastValidProfile(defaultProfile);
          console.log('✅ Using default profile (no Dexie)');
        }
      } catch (dexieError) {
        console.error('❌ Dexie fallback failed:', dexieError);
        const defaultProfile = createDefaultProfile(user.id);
        setProfile(defaultProfile);
        setLastValidProfile(defaultProfile);
        console.log('✅ Using default profile (fallback)');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initialize profile on mount
  useEffect(() => {
    if (user) {
      // ✅ STRUCTURAL FIX: Initialize with default profile to prevent null flicker
      const defaultProfile = createDefaultProfile(user.id);
      setLastValidProfile(defaultProfile);
      console.log('🚀 [useSubscription] Initialized with default profile:', defaultProfile);
    }
    refreshProfile();
  }, [user, refreshProfile]);

  // Real-time subscription for profile changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Profile updated in real-time:', payload);
          console.log('🔄 New tier from real-time update:', payload.new?.subscription_tier);
          // Refresh the profile when it's updated
          refreshProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshProfile]);

  // Feature access check
  const canAccessFeature = useCallback((feature: string): boolean => {
    const currentProfile = profile || lastValidProfile;
    if (!currentProfile) return false;

    const tierConfig = TIER_CONFIGS[currentProfile.tier as keyof typeof TIER_CONFIGS];
    return tierConfig?.features?.includes(feature) || false;
  }, [profile, lastValidProfile]);

  // Usage limit check
  const checkUsageLimit = useCallback(async (actionType: string): Promise<UsageCheck> => {
    const currentProfile = profile || lastValidProfile;
    if (!currentProfile) {
      return { allowed: false, remaining: 0, limit: 0 };
    }

    const tierConfig = TIER_CONFIGS[currentProfile.tier as keyof typeof TIER_CONFIGS];
    const limit = tierConfig?.limits?.[actionType as keyof typeof tierConfig.limits] || 0;
    const current = currentProfile.usage_stats?.[actionType as keyof typeof currentProfile.usage_stats] || 0;
    
    return {
      allowed: current < limit,
      remaining: Math.max(0, limit - current),
      limit
    };
  }, [profile, lastValidProfile]);

  // Update usage
  const updateUsage = useCallback(async (actionType: string, amount: number = 1): Promise<void> => {
    const currentProfile = profile || lastValidProfile;
    if (!currentProfile) return;

    const updatedUsage = {
      ...currentProfile.usage_stats,
      [actionType]: (currentProfile.usage_stats?.[actionType as keyof typeof currentProfile.usage_stats] || 0) + amount
    };

    const updatedProfile = {
      ...currentProfile,
      usage_stats: updatedUsage,
      updated_at: new Date().toISOString()
    };

    setProfile(updatedProfile);
    setLastValidProfile(updatedProfile);

    // Update in Supabase
    try {
      await supabase
        .from('profiles')
        .update({ usage_stats: updatedUsage })
        .eq('id', currentProfile.id);
    } catch (error) {
      console.error('Failed to update usage in Supabase:', error);
    }
  }, [profile, lastValidProfile]);

  // Update subscription tier
  const updateSubscriptionTier = useCallback(async (tier: string): Promise<void> => {
    const currentProfile = profile || lastValidProfile;
    if (!currentProfile) return;

    const updatedProfile = {
      ...currentProfile,
      tier,
      subscription_status: 'active',
      updated_at: new Date().toISOString()
    };

    setProfile(updatedProfile);
    setLastValidProfile(updatedProfile);

    // Update in Supabase
    try {
      await supabase
        .from('profiles')
        .update({ 
          subscription_tier: tier,
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentProfile.id);
    } catch (error) {
      console.error('Failed to update subscription tier in Supabase:', error);
    }
  }, [profile, lastValidProfile]);

  // Get days remaining in trial
  const getDaysRemaining = useCallback((): number | null => {
    const currentProfile = profile || lastValidProfile;
    if (!currentProfile?.trial_ends_at) return null;

    const trialEnd = new Date(currentProfile.trial_ends_at);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }, [profile, lastValidProfile]);

  // Check if trial is expired
  const isTrialExpired = useCallback((): boolean => {
    const daysRemaining = getDaysRemaining();
    return daysRemaining !== null && daysRemaining <= 0;
  }, [getDaysRemaining]);

  // Get usage percentage
  const getUsagePercentage = useCallback((type: 'mood_tracking' | 'emotional_insights' | 'journal_entries' | 'ai_prompts'): number => {
    const currentProfile = profile || lastValidProfile;
    if (!currentProfile) return 0;

    const tierConfig = TIER_CONFIGS[currentProfile.tier as keyof typeof TIER_CONFIGS];
    const limit = tierConfig?.limits?.[type] || 0;
    const current = currentProfile.usage_stats?.[type] || 0;
    
    if (limit === 0) return 0;
    return Math.min(100, (current / limit) * 100);
  }, [profile, lastValidProfile]);

  return {
    // ✅ STRUCTURAL FIX: Never emit null profile - use lastValidProfile as fallback
    profile: profile || lastValidProfile,
    isLoading,
    error,
    checkUsageLimit,
    updateUsage,
    refreshProfile,
    getDaysRemaining,
    isTrialExpired,
    canAccessFeature,
    getUsagePercentage,
    updateSubscriptionTier
  };
};