// Atlas Billing Summary Hook
// Cursor-Style Billing System - React Query hook for billing summary

import { useQuery } from '@tanstack/react-query';
import { fetchBillingSummary, type BillingSummary } from '../services/billingApi';
import { logger } from '../lib/logger';

/**
 * React Query hook for billing summary
 * Auto-refreshes when billing period changes
 * Cache: 5 minutes
 */
export function useBillingSummary() {
  return useQuery<BillingSummary, Error>({
    queryKey: ['billing-summary'],
    queryFn: fetchBillingSummary,
    staleTime: 30 * 1000, // 30 seconds - refresh more frequently to see new usage
    cacheTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    onError: (error) => {
      logger.error('[useBillingSummary] Query error:', error);
    },
    onSuccess: (data) => {
      logger.debug('[useBillingSummary] ✅ Billing summary loaded:', {
        tier: data.tier,
        models: data.models.length,
        totalCost: data.usedCreditsUsd,
        period: `${data.period.start} - ${data.period.end}`
      });
    }
  });
}

