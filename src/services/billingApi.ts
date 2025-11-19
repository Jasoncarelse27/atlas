// Atlas Billing API Client
// Cursor-Style Billing System - Frontend API Client
// Handles billing summary and invoice fetching

import { logger } from '../lib/logger';
import { fetchWithAuthJSON } from './fetchWithAuth';
import { getApiEndpoint } from '../utils/apiClient';

export interface BillingSummary {
  period: {
    start: string;
    end: string;
  };
  tier: 'free' | 'core' | 'studio';
  includedCreditsUsd: number;
  usedCreditsUsd: number;
  remainingCreditsUsd: number | null;
  models: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  }>;
  overage: {
    totalOverageUsd: number;
    charges: Array<{
      id: string;
      description: string;
      costUsd: number;
      status: string;
      createdAt: string;
    }>;
  };
}

export interface BillingInvoice {
  id: string;
  date: string;
  description: string;
  status: 'paid' | 'pending' | 'failed';
  amountUsd: number;
  invoiceUrl: string | null;
}

/**
 * Fetch billing summary for current period
 */
export async function fetchBillingSummary(): Promise<BillingSummary> {
  try {
    const endpoint = getApiEndpoint('/api/billing/summary');
    const data = await fetchWithAuthJSON<BillingSummary>(endpoint);
    
    logger.debug('[BillingAPI] Fetched billing summary:', {
      tier: data.tier,
      usedCredits: data.usedCreditsUsd,
      includedCredits: data.includedCreditsUsd,
      overage: data.overage.totalOverageUsd
    });
    
    return data;
  } catch (error) {
    logger.error('[BillingAPI] Failed to fetch billing summary:', error);
    throw new Error('Failed to fetch billing summary. Please try again.');
  }
}

/**
 * Fetch billing invoices (optionally filtered by month)
 * 
 * @param monthFilter - Optional month filter in YYYY-MM format (e.g. "2025-11")
 */
export async function fetchBillingInvoices(monthFilter?: string): Promise<BillingInvoice[]> {
  try {
    let endpoint = getApiEndpoint('/api/billing/invoices');
    if (monthFilter) {
      endpoint += `?month=${encodeURIComponent(monthFilter)}`;
    }
    
    const data = await fetchWithAuthJSON<BillingInvoice[]>(endpoint);
    
    logger.debug(`[BillingAPI] Fetched ${data.length} invoices${monthFilter ? ` for ${monthFilter}` : ''}`);
    
    return data;
  } catch (error) {
    logger.error('[BillingAPI] Failed to fetch invoices:', error);
    throw new Error('Failed to fetch invoices. Please try again.');
  }
}

