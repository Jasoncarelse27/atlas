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
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    onError: (error) => {
      logger.error('[useBillingSummary] Query error:', error);
    }
  });
}

