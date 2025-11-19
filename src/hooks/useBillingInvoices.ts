// Atlas Billing Invoices Hook
// Cursor-Style Billing System - React Query hook for invoices

import { useQuery } from '@tanstack/react-query';
import { fetchBillingInvoices, type BillingInvoice } from '../services/billingApi';
import { logger } from '../lib/logger';

/**
 * React Query hook for billing invoices
 * Supports month filter
 * Cache: 10 minutes
 * 
 * @param monthFilter - Optional month filter in YYYY-MM format (e.g. "2025-11")
 */
export function useBillingInvoices(monthFilter?: string) {
  return useQuery<BillingInvoice[], Error>({
    queryKey: ['billing-invoices', monthFilter],
    queryFn: () => fetchBillingInvoices(monthFilter),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    onError: (error) => {
      logger.error('[useBillingInvoices] Query error:', error);
    }
  });
}

