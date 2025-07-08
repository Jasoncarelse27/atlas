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
  getUsagePercentage: (type: 'requests' | 'audio' | 'storage') => number;
  updateSubscriptionTier: (tier: string) => Promise<void>;
}

export const useSubscription = (user: User | null): UseSubscriptionReturn => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createDefaultProfile = (userId: string): UserProfile => {
    return {
      id: userId,
      tier: 'basic',
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      subscription_status: 'trial',
      subscription_id: null,
      usage_stats: {
        requests_this_month: 0,
        audio_minutes_this_month: 0,
        storage_used_mb: 0,
        last_reset_date: null
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  };

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('📊 Fetching user profile for:', user.id);

      // Check if supabase is properly configured
      if (!supabase || typeof supabase.from !== 'function') {
        console.warn('⚠️ Supabase not configured, using default profile');
        const defaultProfile = createDefaultProfile(user.id);
        setProfile(defaultProfile);
        setIsLoading(false);
        return;
      }

      // Try to fetch profile with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 5000);
      });

      const fetchPromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const { data, error: fetchError } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (fetchError) {
        // Handle specific Supabase errors
        if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('timeout')) {
          console.warn('⚠️ Database connection failed, using default profile');
          const defaultProfile = createDefaultProfile(user.id);
          setProfile(defaultProfile);
          setError('Using offline mode - some features may be limited');
          setIsLoading(false);
          return;
        }

        if (fetchError.message?.includes('JWT') || fetchError.message?.includes('Invalid API key')) {
          console.warn('⚠️ Authentication failed, using default profile');
          const defaultProfile = createDefaultProfile(user.id);
          setProfile(defaultProfile);
          setError('Authentication issue - using offline mode');
          setIsLoading(false);
          return;
        }

        if (fetchError.code === 'PGRST116') {
          // Profile doesn't exist, try to create one
          console.log('📊 Profile not found, creating default profile...');
          
          try {
            const { data: newProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert([createDefaultProfile(user.id)])
              .select()
              .single();

            if (createError) {
              console.warn('⚠️ Error creating profile, using default:', createError);
              const defaultProfile = createDefaultProfile(user.id);
              setProfile(defaultProfile);
              setError('Using offline mode - profile creation failed');
            } else {
              console.log('✅ Profile created successfully:', newProfile);
              setProfile(newProfile);
            }
          } catch (createErr) {
            console.warn('⚠️ Error in profile creation, using default:', createErr);
            const defaultProfile = createDefaultProfile(user.id);
            setProfile(defaultProfile);
            setError('Using offline mode - database unavailable');
          }
        } else {
          console.warn('⚠️ Database error, using default profile:', fetchError);
          const defaultProfile = createDefaultProfile(user.id);
          setProfile(defaultProfile);
          setError('Using offline mode - database error');
        }
      } else {
        console.log('✅ Profile fetched successfully:', data);
        setProfile(data);
        setError(null);
      }
    } catch (err) {
      console.warn('⚠️ Error in fetchProfile, using default profile:', err);
      
      // Always provide a default profile to keep the app functional
      const defaultProfile = createDefaultProfile(user.id);
      setProfile(defaultProfile);
      setError('Using offline mode - connection failed');
    } finally {
      setIsLoading(false);
    }
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

      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

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

  const clientSideUsageCheck = (actionType: string): UsageCheck => {
    if (!profile) {
      return { allowed: false, reason: 'Profile not found' };
    }

    console.log('📊 Client-side usage check for:', actionType, 'Profile:', profile);

    // Check if trial has expired for basic users
    if (profile.tier === 'basic' && profile.subscription_status === 'trial' && profile.trial_ends_at) {
      const trialEnd = new Date(profile.trial_ends_at);
      if (trialEnd < new Date()) {
        return { allowed: false, reason: 'Trial expired' };
      }
    }

    const tierConfig = TIER_CONFIGS[profile.tier];
    if (!tierConfig) {
      return { allowed: false, reason: 'Invalid tier' };
    }

    const usage = profile.usage_stats;

    // Check specific action limits
    switch (actionType) {
      case 'request':
        if (tierConfig.limits.requests_per_month !== -1 && 
            usage.requests_this_month >= tierConfig.limits.requests_per_month) {
          return { allowed: false, reason: 'Monthly request limit exceeded' };
        }
        break;
      case 'audio':
        if (tierConfig.limits.audio_minutes_per_month !== -1 && 
            usage.audio_minutes_this_month >= tierConfig.limits.audio_minutes_per_month) {
          return { allowed: false, reason: 'Monthly audio limit exceeded' };
        }
        break;
      case 'storage':
        if (usage.storage_used_mb >= tierConfig.limits.storage_limit_mb) {
          return { allowed: false, reason: 'Storage limit exceeded' };
        }
        break;
    }

    return {
      allowed: true,
      tier: profile.tier,
      limits: tierConfig.limits,
      usage: usage
    };
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

      const { error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

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

  const clientSideUsageUpdate = async (actionType: string, amount: number): Promise<void> => {
    if (!profile) return;

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    let newUsage = { ...profile.usage_stats };

    // Reset monthly stats if it's a new month
    if (!newUsage.last_reset_date || newUsage.last_reset_date !== currentMonth) {
      newUsage = {
        requests_this_month: 0,
        audio_minutes_this_month: 0,
        storage_used_mb: newUsage.storage_used_mb || 0, // Keep storage across months
        last_reset_date: currentMonth
      };
    }

    // Update specific usage
    switch (actionType) {
      case 'request':
        newUsage.requests_this_month = (newUsage.requests_this_month || 0) + amount;
        break;
      case 'audio':
        newUsage.audio_minutes_this_month = (newUsage.audio_minutes_this_month || 0) + amount;
        break;
      case 'storage':
        newUsage.storage_used_mb = (newUsage.storage_used_mb || 0) + amount;
        break;
    }

    console.log('📊 Client-side usage update:', { actionType, amount, newUsage });

    try {
      // Check if supabase is properly configured
      if (!supabase || typeof supabase.from !== 'function') {
        console.warn('⚠️ Supabase not configured, updating local state only');
        setProfile(prev => prev ? { ...prev, usage_stats: newUsage } : null);
        return;
      }

      // Try to update the profile with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Update timeout')), 3000);
      });

      const updatePromise = supabase
        .from('user_profiles')
        .update({ 
          usage_stats: newUsage, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', user.id);

      const { error } = await Promise.race([updatePromise, timeoutPromise]) as any;

      if (error) {
        console.warn('⚠️ Error updating profile, using local state:', error);
        setProfile(prev => prev ? { ...prev, usage_stats: newUsage } : null);
      } else {
        console.log('✅ Profile updated successfully');
        // Update local state
        setProfile(prev => prev ? { ...prev, usage_stats: newUsage } : null);
      }
    } catch (err) {
      console.warn('⚠️ Error in clientSideUsageUpdate, using local state:', err);
      setProfile(prev => prev ? { ...prev, usage_stats: newUsage } : null);
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
          // If upgrading from trial, set a subscription ID
          ...(profile.subscription_status === 'trial' ? { 
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
          ...(prev.subscription_status === 'trial' ? { 
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
    if (!profile || profile.tier !== 'basic' || profile.subscription_status !== 'trial' || !profile.trial_ends_at) {
      return null;
    }

    const trialEnd = new Date(profile.trial_ends_at);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  const isTrialExpired = (): boolean => {
    if (!profile || profile.tier !== 'basic' || profile.subscription_status !== 'trial') {
      return false;
    }

    const daysRemaining = getDaysRemaining();
    return daysRemaining !== null && daysRemaining <= 0;
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

    // Check if trial has expired for basic users
    if (profile.tier === 'basic' && isTrialExpired()) {
      return false;
    }

    return tierConfig.limits.features.includes(feature);
  };

  const getUsagePercentage = (type: 'requests' | 'audio' | 'storage'): number => {
    if (!profile) return 0;

    const tierConfig = TIER_CONFIGS[profile.tier];
    if (!tierConfig) return 0;

    const usage = profile.usage_stats;
    
    switch (type) {
      case 'requests':
        if (tierConfig.limits.requests_per_month === -1) return 0; // Unlimited
        return Math.min(100, (usage.requests_this_month / tierConfig.limits.requests_per_month) * 100);
      
      case 'audio':
        if (tierConfig.limits.audio_minutes_per_month === -1) return 0; // Unlimited
        return Math.min(100, (usage.audio_minutes_this_month / tierConfig.limits.audio_minutes_per_month) * 100);
      
      case 'storage':
        return Math.min(100, (usage.storage_used_mb / tierConfig.limits.storage_limit_mb) * 100);
      
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