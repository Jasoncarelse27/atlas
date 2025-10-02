import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mutationKeys, queryKeys } from '../lib/queryClient';
import type { SubscriptionProfile, UpgradeRequest, UsageStats } from '../services/subscriptionService';
import { subscriptionService } from '../services/subscriptionService';
import type { UserTier } from './useSubscriptionAccess';

/**
 * Hook for managing user subscription and tier information
 * Provides React Query integration with proper caching and optimistic updates
 */
export function useSubscription(userId: string) {
  const queryClient = useQueryClient();

  // Get user profile
  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile
  } = useQuery({
    queryKey: queryKeys.userProfile.detail(userId),
    queryFn: () => subscriptionService.getUserProfile(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  // Get user tier
  const {
    data: tier = 'free' as UserTier,
    isLoading: isTierLoading,
    error: tierError,
    refetch: refetchTier
  } = useQuery({
    queryKey: queryKeys.userProfile.subscription(userId),
    queryFn: () => subscriptionService.getUserTier(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  // Get usage statistics
  const {
    data: usageStats,
    isLoading: isUsageLoading,
    error: usageError,
    refetch: refetchUsage
  } = useQuery({
    queryKey: queryKeys.userProfile.usage(userId),
    queryFn: () => subscriptionService.getUsageStats(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes (usage changes frequently)
    gcTime: 1000 * 60 * 15, // 15 minutes
  });

  // Upgrade tier mutation
  const upgradeTier = useMutation({
    mutationKey: mutationKeys.userProfile.upgrade,
    mutationFn: (request: UpgradeRequest) => subscriptionService.upgradeTier(request),
    onMutate: async (request) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.userProfile.detail(userId) });
      await queryClient.cancelQueries({ queryKey: queryKeys.userProfile.subscription(userId) });
      
      // Snapshot previous values
      const previousProfile = queryClient.getQueryData(queryKeys.userProfile.detail(userId));
      const previousTier = queryClient.getQueryData(queryKeys.userProfile.subscription(userId));
      
      // Optimistically update profile
      if (previousProfile) {
        queryClient.setQueryData(
          queryKeys.userProfile.detail(userId),
          (old: SubscriptionProfile | undefined) => {
            if (!old) return old;
            return {
              ...old,
              tier: request.newTier,
              subscription_status: 'trialing',
              updated_at: new Date().toISOString(),
            };
          }
        );
      }
      
      // Optimistically update tier
      queryClient.setQueryData(
        queryKeys.userProfile.subscription(userId),
        request.newTier
      );
      
      return { previousProfile, previousTier };
    },
    onSuccess: (response) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.detail(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.subscription(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.usage(userId) });
      
      // If checkout URL is provided, redirect user
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      }
    },
    onError: (error, request, context) => {
      // Rollback optimistic updates on error
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.userProfile.detail(userId),
          context.previousProfile
        );
      }
      
      if (context?.previousTier) {
        queryClient.setQueryData(
          queryKeys.userProfile.subscription(userId),
          context.previousTier
        );
      }
    },
    onSettled: () => {
      // Always refetch after mutation
      refetchProfile();
      refetchTier();
      refetchUsage();
    },
  });

  // Cancel subscription mutation
  const cancelSubscription = useMutation({
    mutationKey: ['subscription', 'cancel'],
    mutationFn: () => subscriptionService.cancelSubscription(userId),
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.userProfile.detail(userId) });
      
      // Snapshot previous value
      const previousProfile = queryClient.getQueryData(queryKeys.userProfile.detail(userId));
      
      // Optimistically update profile
      if (previousProfile) {
        queryClient.setQueryData(
          queryKeys.userProfile.detail(userId),
          (old: SubscriptionProfile | undefined) => {
            if (!old) return old;
            return {
              ...old,
              subscription_status: 'cancelled',
              updated_at: new Date().toISOString(),
            };
          }
        );
      }
      
      return { previousProfile };
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.detail(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.subscription(userId) });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.userProfile.detail(userId),
          context.previousProfile
        );
      }
    },
    onSettled: () => {
      // Always refetch after mutation
      refetchProfile();
    },
  });

  // Reactivate subscription mutation
  const reactivateSubscription = useMutation({
    mutationKey: ['subscription', 'reactivate'],
    mutationFn: () => subscriptionService.reactivateSubscription(userId),
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.userProfile.detail(userId) });
      
      // Snapshot previous value
      const previousProfile = queryClient.getQueryData(queryKeys.userProfile.detail(userId));
      
      // Optimistically update profile
      if (previousProfile) {
        queryClient.setQueryData(
          queryKeys.userProfile.detail(userId),
          (old: SubscriptionProfile | undefined) => {
            if (!old) return old;
            return {
              ...old,
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            };
          }
        );
      }
      
      return { previousProfile };
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.detail(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.subscription(userId) });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.userProfile.detail(userId),
          context.previousProfile
        );
      }
    },
    onSettled: () => {
      // Always refetch after mutation
      refetchProfile();
    },
  });

  // Update usage stats mutation
  const updateUsageStats = useMutation({
    mutationKey: ['subscription', 'updateUsage'],
    mutationFn: (updates: Partial<UsageStats>) => 
      subscriptionService.updateUsageStats(userId, updates),
    onSuccess: (newStats) => {
      // Update usage stats in cache
      queryClient.setQueryData(
        queryKeys.userProfile.usage(userId),
        newStats
      );
      
      // Update profile cache if it exists
      queryClient.setQueryData(
        queryKeys.userProfile.detail(userId),
        (old: SubscriptionProfile | undefined) => {
          if (!old) return old;
          return {
            ...old,
            usage_stats: newStats,
            updated_at: new Date().toISOString(),
          };
        }
      );
    },
  });

  // Increment message count mutation
  const incrementMessageCount = useMutation({
    mutationKey: ['subscription', 'incrementMessage'],
    mutationFn: () => subscriptionService.incrementMessageCount(userId),
    onSuccess: () => {
      // Invalidate usage stats to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.usage(userId) });
    },
  });

  // Reset daily usage mutation
  const resetDailyUsage = useMutation({
    mutationKey: ['subscription', 'resetDaily'],
    mutationFn: () => subscriptionService.resetDailyUsage(userId),
    onSuccess: () => {
      // Invalidate usage stats to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.usage(userId) });
    },
  });

  // Reset monthly usage mutation
  const resetMonthlyUsage = useMutation({
    mutationKey: ['subscription', 'resetMonthly'],
    mutationFn: () => subscriptionService.resetMonthlyUsage(userId),
    onSuccess: () => {
      // Invalidate usage stats to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile.usage(userId) });
    },
  });

  // Computed values
  const tierLimits = subscriptionService.getTierLimits(tier);
  const canSendMessage = usageStats ? usageStats.messages_today < (tierLimits.dailyMessages === -1 ? Infinity : tierLimits.dailyMessages) : false;
  const remainingMessages = usageStats ? Math.max(0, (tierLimits.dailyMessages === -1 ? Infinity : tierLimits.dailyMessages) - usageStats.messages_today) : 0;
  const showUpgradePrompt = tier !== 'studio' && usageStats && usageStats.messages_today >= Math.floor(tierLimits.dailyMessages * 0.8);

  return {
    // Data
    profile,
    tier,
    usageStats,
    tierLimits,
    
    // Computed values
    canSendMessage,
    remainingMessages,
    showUpgradePrompt,
    
    // Loading states
    isLoading: isProfileLoading || isTierLoading || isUsageLoading,
    isProfileLoading,
    isTierLoading,
    isUsageLoading,
    
    // Error states
    error: profileError || tierError || usageError,
    profileError,
    tierError,
    usageError,
    
    // Actions
    upgradeTier: upgradeTier.mutate,
    upgradeTierAsync: upgradeTier.mutateAsync,
    cancelSubscription: cancelSubscription.mutate,
    cancelSubscriptionAsync: cancelSubscription.mutateAsync,
    reactivateSubscription: reactivateSubscription.mutate,
    reactivateSubscriptionAsync: reactivateSubscription.mutateAsync,
    updateUsageStats: updateUsageStats.mutate,
    updateUsageStatsAsync: updateUsageStats.mutateAsync,
    incrementMessageCount: incrementMessageCount.mutate,
    incrementMessageCountAsync: incrementMessageCount.mutateAsync,
    resetDailyUsage: resetDailyUsage.mutate,
    resetMonthlyUsage: resetMonthlyUsage.mutate,
    
    // Mutation states
    isUpgrading: upgradeTier.isPending,
    isCancelling: cancelSubscription.isPending,
    isReactivating: reactivateSubscription.isPending,
    isUpdatingUsage: updateUsageStats.isPending,
    isIncrementing: incrementMessageCount.isPending,
    
    // Mutation errors
    upgradeError: upgradeTier.error,
    cancelError: cancelSubscription.error,
    reactivateError: reactivateSubscription.error,
    updateUsageError: updateUsageStats.error,
    incrementError: incrementMessageCount.error,
    
    // Utilities
    refetchProfile,
    refetchTier,
    refetchUsage,
  };
}

/**
 * Hook for checking if user can perform specific actions based on tier
 */
export function useTierAccess(userId: string) {
  const { tier, tierLimits, canSendMessage, remainingMessages } = useSubscription(userId);

  const canUseFeature = (feature: string): boolean => {
    switch (feature) {
      case 'voice':
        return tier === 'core' || tier === 'studio';
      case 'image':
        return tier === 'core' || tier === 'studio';
      case 'unlimited_messages':
        return tier === 'studio';
      case 'priority_support':
        return tier === 'studio';
      default:
        return true;
    }
  };

  const getFeatureLimit = (feature: string): number | null => {
    switch (feature) {
      case 'daily_messages':
        return tierLimits.dailyMessages === -1 ? null : tierLimits.dailyMessages;
      case 'monthly_messages':
        return tierLimits.monthlyMessages === -1 ? null : tierLimits.monthlyMessages;
      default:
        return null;
    }
  };

  return {
    tier,
    tierLimits,
    canSendMessage,
    remainingMessages,
    canUseFeature,
    getFeatureLimit,
  };
}
