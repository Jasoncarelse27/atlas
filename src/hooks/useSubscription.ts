import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile, UsageCheck } from '../types/subscription';
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

  const createDefaultProfile = (userId: string): UserProfile => {
    return {
      id: userId,
      tier: 'free',
      trial_ends_at: null, // Free tier doesn't have a trial
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

  const fetchProfile = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('📊 Fetching user profile for:', user.id);

      // Check if supabase is properly configured
      if (!supabase || typeof supabase.from !== 'function') {
        console.warn('⚠️ Supabase not configured, using mock profile');
        const mockProfile = createDefaultProfile(user.id);
        setProfile(mockProfile);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create default
          console.log('📊 Creating default profile for new user');
          const defaultProfile = createDefaultProfile(user.id);
          
          const { error: insertError } = await supabase
              .from('user_profiles')
            .insert(defaultProfile);

          if (insertError) {
            console.error('❌ Error creating profile:', insertError);
            setError(insertError.message);
            } else {
            setProfile(defaultProfile);
          }
        } else {
          console.error('❌ Error fetching profile:', error);
          setError(error.message);
        }
      } else {
        console.log('✅ Profile fetched successfully:', data);
        setProfile(data);
      }
    } catch (err) {
      console.error('❌ Unexpected error in fetchProfile:', err);
      setError('Failed to fetch user profile');
    } finally {
      setIsLoading(false);
    }
  };

  const clientSideUsageCheck = (actionType: string): UsageCheck => {
    if (!profile) {
      return { allowed: false, reason: 'Profile not found' };
    }

    console.log('📊 Client-side usage check for:', actionType, 'Profile:', profile);

    const tierConfig = TIER_CONFIGS[profile.tier];
    if (!tierConfig) {
      return { allowed: false, reason: 'Invalid tier' };
    }

    const usage = profile.usage_stats;

    // Check specific action limits
    switch (actionType) {
      case 'mood_tracking':
        if (tierConfig.limits.mood_tracking_days_per_month !== -1 && 
            usage.mood_tracking_days >= tierConfig.limits.mood_tracking_days_per_month) {
          return { allowed: false, reason: 'Monthly mood tracking limit exceeded' };
        }
        break;
      case 'emotional_insight':
        if (tierConfig.limits.emotional_insights_per_month !== -1 && 
            usage.emotional_insights_this_month >= tierConfig.limits.emotional_insights_per_month) {
          return { allowed: false, reason: 'Monthly emotional insights limit exceeded' };
        }
        break;
      case 'journal_entry':
        if (tierConfig.limits.journal_entries_per_month !== -1 && 
            usage.journal_entries_this_month >= tierConfig.limits.journal_entries_per_month) {
          return { allowed: false, reason: 'Monthly journal entries limit exceeded' };
        }
        break;
      case 'ai_prompt': {
        if (tierConfig.limits.ai_prompts_per_day !== -1) {
          // Check daily limit - would need to track daily usage
          // For now, using monthly as approximation
          const monthlyLimit = tierConfig.limits.ai_prompts_per_day * 30;
          if (usage.ai_prompts_this_month >= monthlyLimit) {
            return { allowed: false, reason: 'Daily AI prompts limit exceeded' };
          }
        }
        break;
      }
    }

    return {
      allowed: true,
      tier: profile.tier,
      limits: tierConfig.limits,
      usage: usage
    };
  };

  const checkUsageLimit = async (actionType: string): Promise<UsageCheck> => {
    if (!user || !profile) {
      return { allowed: false, reason: 'User not authenticated' };
    }

    try {
      console.log('📊 Checking usage limit for:', actionType);
      
      // Check if supabase is properly configured before trying RPC
      if (!supabase || typeof supabase.rpc !== 'function') {
        console.warn('⚠️ Supabase not configured, using client-side check');
        return clientSideUsageCheck(actionType);
      }
      
      // Try RPC function with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('RPC timeout')), 3000);
      });

      const rpcPromise = supabase.rpc('check_tier_limits', {
        user_id: user.id,
        action_type: actionType
      });

      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as { data: UsageCheck; error: any };

      if (error) {
        console.warn('⚠️ RPC function failed, using client-side check:', error);
        return clientSideUsageCheck(actionType);
      }

      console.log('✅ Usage check result:', data);
      return data as UsageCheck;
    } catch (err) {
      console.warn('⚠️ Error checking usage limits, falling back to client-side:', err);
      return clientSideUsageCheck(actionType);
    }
  };

  const clientSideUsageUpdate = async (actionType: string, amount: number = 1): Promise<void> => {
    if (!profile) return;

    console.log('📊 Client-side usage update:', actionType, 'amount:', amount);

    const updatedUsage = { ...profile.usage_stats };

    switch (actionType) {
      case 'mood_tracking':
        updatedUsage.mood_tracking_days += amount;
        break;
      case 'emotional_insight':
        updatedUsage.emotional_insights_this_month += amount;
        break;
      case 'journal_entry':
        updatedUsage.journal_entries_this_month += amount;
        break;
      case 'ai_prompt':
        updatedUsage.ai_prompts_this_month += amount;
        break;
      case 'streak_update':
        updatedUsage.streak_days = amount; // Set to new streak value
        break;
    }

    setProfile(prev => prev ? { ...prev, usage_stats: updatedUsage } : null);
  };

  const updateUsage = async (actionType: string, amount: number = 1): Promise<void> => {
    if (!user || !profile) return;

    try {
      console.log('📊 Updating usage:', actionType, 'amount:', amount);
      
      // Check if supabase is properly configured before trying RPC
      if (!supabase || typeof supabase.rpc !== 'function') {
        console.warn('⚠️ Supabase not configured, using client-side update');
        await clientSideUsageUpdate(actionType, amount);
        return;
      }
      
      // Try RPC with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('RPC timeout')), 3000);
      });

      const rpcPromise = supabase.rpc('update_usage_stats', {
        user_id: user.id,
        action_type: actionType,
        amount: amount
      });

      const { error } = await Promise.race([rpcPromise, timeoutPromise]) as { error: any };

      if (error) {
        console.warn('⚠️ RPC update failed, using client-side update:', error);
        await clientSideUsageUpdate(actionType, amount);
      } else {
        console.log('✅ Usage updated via RPC');
        // Refresh profile to get updated usage
        await fetchProfile();
      }
    } catch (err) {
      console.warn('⚠️ Error updating usage stats, falling back to client-side:', err);
      await clientSideUsageUpdate(actionType, amount);
    }
  };

  const updateSubscriptionTier = async (tier: string): Promise<void> => {
    if (!user || !profile) return;

    try {
      console.log('📊 Updating subscription tier to:', tier);
      
      // Check if supabase is properly configured
      if (!supabase || typeof supabase.from !== 'function') {
        console.warn('⚠️ Supabase not configured, updating local state only');
        setProfile(prev => prev ? { 
          ...prev, 
          tier, 
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        } : null);
        return;
      }

      // Update the profile in the database
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          tier, 
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
          // If upgrading from free, set a subscription ID
          ...(profile.tier === 'free' ? { 
            subscription_id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
          } : {})
        })
        .eq('id', user.id);

      if (error) {
        console.warn('⚠️ Error updating subscription tier:', error);
        throw new Error(`Failed to update subscription: ${error.message}`);
      } else {
        console.log('✅ Subscription tier updated successfully');
        // Update local state
        setProfile(prev => prev ? { 
          ...prev, 
          tier, 
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
          ...(prev.tier === 'free' ? { 
            subscription_id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
          } : {})
        } : null);
      }
    } catch (err) {
      console.error('⚠️ Error in updateSubscriptionTier:', err);
      throw err;
    }
  };

  const refreshProfile = async (): Promise<void> => {
    console.log('📊 Refreshing profile...');
    await fetchProfile();
  };

  const getDaysRemaining = (): number | null => {
    // Free tier doesn't have trial days
      return null;
  };

  const isTrialExpired = (): boolean => {
    // Free tier doesn't have trial
      return false;
  };

  const canAccessFeature = (feature: string): boolean => {
    // DEVELOPMENT BYPASS: In development mode, allow access to all features
    if (import.meta.env.DEV) {
      console.log('🔓 DEV MODE: Bypassing feature access restrictions for', feature);
      return true;
    }

    if (!profile) return false;

    const tierConfig = TIER_CONFIGS[profile.tier];
    if (!tierConfig) return false;

    return tierConfig.limits.features.includes(feature);
  };

  const getUsagePercentage = (type: 'mood_tracking' | 'emotional_insights' | 'journal_entries' | 'ai_prompts'): number => {
    if (!profile) return 0;

    const tierConfig = TIER_CONFIGS[profile.tier];
    if (!tierConfig) return 0;

    const usage = profile.usage_stats;
    
    switch (type) {
      case 'mood_tracking':
        if (tierConfig.limits.mood_tracking_days_per_month === -1) return 0; // Unlimited
        return Math.min(100, (usage.mood_tracking_days / tierConfig.limits.mood_tracking_days_per_month) * 100);
      
      case 'emotional_insights':
        if (tierConfig.limits.emotional_insights_per_month === -1) return 0; // Unlimited
        return Math.min(100, (usage.emotional_insights_this_month / tierConfig.limits.emotional_insights_per_month) * 100);
      
      case 'journal_entries':
        if (tierConfig.limits.journal_entries_per_month === -1) return 0; // Unlimited
        return Math.min(100, (usage.journal_entries_this_month / tierConfig.limits.journal_entries_per_month) * 100);
      
      case 'ai_prompts': {
        if (tierConfig.limits.ai_prompts_per_day === -1) return 0; // Unlimited
        // Using monthly as approximation for daily limit
        const dailyLimit = tierConfig.limits.ai_prompts_per_day;
        const monthlyLimit = dailyLimit * 30;
        return Math.min(100, (usage.ai_prompts_this_month / monthlyLimit) * 100);
      }
      
      default:
        return 0;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return {
    profile,
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