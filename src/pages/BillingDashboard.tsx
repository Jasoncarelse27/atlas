// Atlas Billing Dashboard
// Cursor-Style Billing System - Billing Dashboard Page
// Displays included usage, on-demand usage, and invoices

import { ChevronDown, ExternalLink } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import QuickActions from '../components/sidebar/QuickActions';
import UsageCounter from '../components/sidebar/UsageCounter';
import { useBillingInvoices } from '../hooks/useBillingInvoices';
import { useBillingSummary } from '../hooks/useBillingSummary';
import { useTierQuery } from '../hooks/useTierQuery';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

const BillingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | undefined>(undefined);

  // Fetch billing data
  const { data: billingSummary, isLoading: summaryLoading, error: summaryError } = useBillingSummary();
  const { data: invoices, isLoading: invoicesLoading, error: invoicesError } = useBillingInvoices(monthFilter);
  const { tier } = useTierQuery();

  // Get current user
  React.useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Format date range for display
  const periodDisplay = useMemo(() => {
    if (!billingSummary?.period) return '';
    const start = new Date(billingSummary.period.start);
    const end = new Date(billingSummary.period.end);
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }, [billingSummary]);

  // Generate month options for filter
  const monthOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const now = new Date();
    
    // Generate last 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    
    return options;
  }, []);

  // Format token count for display
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
    } else if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K tokens`;
    }
    return `${tokens.toLocaleString()} tokens`;
  };

  // Format currency for display
  const formatCurrency = (amount: number): string => {
    return `US $${amount.toFixed(2)}`;
  };

  if (summaryError || invoicesError) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-atlas-bg-light dark:bg-gray-900 flex">
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Billing</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {summaryError?.message || invoicesError?.message || 'Failed to load billing information'}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-atlas-sage dark:bg-gray-700 text-white rounded-md hover:bg-atlas-success dark:hover:bg-gray-600"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-atlas-bg-light dark:bg-gray-900 flex">
        {/* Sidebar */}
        <div className={`hidden sm:flex flex-col w-64 bg-white/50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700`}>
          <div className="p-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Atlas</h1>
            <QuickActions
              onNewChat={() => navigate('/chat')}
              onViewHistory={() => navigate('/chat')}
              userId={userId || undefined}
            />
          </div>
          {userId && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <UsageCounter userId={userId} />
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing</h1>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {summaryLoading ? (
              <div className="space-y-6">
                <Skeleton height={200} />
                <Skeleton height={150} />
                <Skeleton height={300} />
              </div>
            ) : billingSummary ? (
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Included Usage Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Included Usage</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{periodDisplay}</p>
                  
                  {billingSummary.models.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Model</th>
                              <th className="text-right py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Tokens</th>
                              <th className="text-right py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billingSummary.models.map((model, index) => (
                              <tr key={index} className="border-b border-gray-100 dark:border-gray-700/50">
                                <td className="py-2 text-sm text-gray-900 dark:text-white font-mono">{model.model}</td>
                                <td className="py-2 text-sm text-gray-600 dark:text-gray-400 text-right">
                                  {formatTokens(model.inputTokens + model.outputTokens)}
                                </td>
                                <td className="py-2 text-sm text-gray-900 dark:text-white text-right font-medium">
                                  {formatCurrency(model.totalCostUsd)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                              <td colSpan={2} className="py-2 text-sm font-semibold text-gray-900 dark:text-white text-right">
                                Total Cost:
                              </td>
                              <td className="py-2 text-sm font-semibold text-gray-900 dark:text-white text-right">
                                {formatCurrency(billingSummary.usedCreditsUsd)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">No usage recorded for this period.</p>
                  )}
                </div>

                {/* On-Demand Usage Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">On-Demand Usage</h2>
                  {billingSummary.overage.totalOverageUsd > 0 ? (
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(billingSummary.overage.totalOverageUsd)}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">No overage charges for this period.</p>
                  )}
                </div>

                {/* Invoices Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invoices</h2>
                    <div className="relative">
                      <select
                        value={monthFilter || ''}
                        onChange={(e) => setMonthFilter(e.target.value || undefined)}
                        className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 pr-8 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-atlas-sage dark:focus:ring-gray-600"
                      >
                        <option value="">All Months</option>
                        {monthOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                  </div>

                  {invoicesLoading ? (
                    <Skeleton height={200} />
                  ) : invoices && invoices.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Date</th>
                            <th className="text-left py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                            <th className="text-left py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                            <th className="text-right py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                            <th className="text-right py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Invoice</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((invoice) => (
                            <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-700/50">
                              <td className="py-2 text-sm text-gray-900 dark:text-white">
                                {new Date(invoice.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="py-2 text-sm text-gray-600 dark:text-gray-400">{invoice.description}</td>
                              <td className="py-2">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  invoice.status === 'paid' 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : invoice.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>
                                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                </span>
                              </td>
                              <td className="py-2 text-sm text-gray-900 dark:text-white text-right font-medium">
                                {formatCurrency(invoice.amountUsd)}
                              </td>
                              <td className="py-2 text-right">
                                {invoice.invoiceUrl ? (
                                  <a
                                    href={invoice.invoiceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-sm text-atlas-sage dark:text-atlas-success hover:underline"
                                  >
                                    View
                                    <ExternalLink className="ml-1 w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-sm text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">No invoices found.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default BillingDashboard;

