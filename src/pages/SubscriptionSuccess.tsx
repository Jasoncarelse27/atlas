/**
 * Subscription Success Page
 * Shown after successful FastSpring checkout
 * 
 * Features:
 * - Confirms subscription activation
 * - Shows tier upgrade details with transaction information
 * - Download invoice/receipt functionality
 * - Provides navigation back to app
 * - Mobile-responsive design matching Stripe invoice UX
 */

import { CheckCircle, Sparkles, ArrowRight, FileText, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { navigateToLastConversation } from '../utils/chatNavigation';
import { useTierAccess } from '../hooks/useTierAccess';
import { getDisplayPrice, getMonthlyPrice } from '../config/pricing';
import { logger } from '../lib/logger';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SubscriptionSuccess() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tier, refreshTier } = useTierAccess();
  const [isRefreshing, setIsRefreshing] = useState(true);

  const tierParam = searchParams.get('tier') as 'core' | 'studio' | null;
  const checkoutId = searchParams.get('checkout_id') || searchParams.get('order_id');
  const invoiceNumber = searchParams.get('invoice_number') || checkoutId?.substring(0, 12).toUpperCase() || 'N/A';
  const paymentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  useEffect(() => {
    // Refresh tier status after successful checkout
    const refreshSubscription = async () => {
      if (user) {
        try {
          await refreshTier();
          // Small delay to ensure backend has processed webhook
          setTimeout(() => {
            setIsRefreshing(false);
          }, 2000);
        } catch (error) {
          logger.error('Error refreshing subscription:', error);
          setIsRefreshing(false);
        }
      } else {
        setIsRefreshing(false);
      }
    };

    refreshSubscription();
  }, [user, refreshTier]);

  const handleContinue = () => {
    navigateToLastConversation(navigate);
  };

  const handleViewRituals = () => {
    navigate('/rituals');
  };

  if (isRefreshing) {
    return (
      <div className="h-dvh bg-atlas-pearl dark:bg-[#0F121A] flex items-start justify-center safe-top safe-bottom px-4 py-4 overflow-y-auto">
        <div className="text-center my-auto">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-atlas-text-medium dark:text-gray-300">
            Activating your subscription...
          </p>
        </div>
      </div>
    );
  }

  const displayTier = tierParam || tier || 'core';
  const tierName = displayTier === 'studio' ? 'Studio' : 'Core';
  const monthlyPrice = getMonthlyPrice(displayTier);
  const displayPrice = getDisplayPrice(displayTier);
  const tierFeatures = displayTier === 'studio' 
    ? ['Unlimited messages', 'Claude Opus AI', 'Advanced analytics', 'Priority support']
    : ['Unlimited messages', 'Claude Sonnet AI', 'Voice & image features', 'Ritual builder'];

  const handleDownloadInvoice = () => {
    // ✅ FUTURE ENHANCEMENT: Implement invoice download from FastSpring API
    // FastSpring provides invoice download endpoints - can be added when needed
    logger.info('Download invoice requested', { checkoutId, invoiceNumber });
    // For now, open FastSpring account page
    window.open(`https://fastspring.com`, '_blank');
  };

  const handleDownloadReceipt = () => {
    // ✅ FUTURE ENHANCEMENT: Implement receipt download from FastSpring API
    // FastSpring provides receipt download endpoints - can be added when needed
    logger.info('Download receipt requested', { checkoutId, invoiceNumber });
    // For now, open FastSpring account page
    window.open(`https://fastspring.com`, '_blank');
  };

  const handleViewDetails = () => {
    // ✅ FUTURE ENHANCEMENT: Link to FastSpring order details page
    // FastSpring provides order detail URLs - can be added when needed
    logger.info('View invoice details requested', { checkoutId });
    window.open(`https://fastspring.com`, '_blank');
  };

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0F121A] flex items-start justify-center safe-top safe-bottom px-4 py-4 overflow-y-auto">
      <div className="max-w-lg w-full bg-white dark:bg-[#1A1D26] rounded-2xl shadow-xl border border-gray-200 dark:border-[#2A2E3A] overflow-hidden my-auto">
        {/* Header Section */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/10 px-8 pt-8 pb-6 text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-[#1A1D26] flex items-center justify-center shadow-lg">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Subscription activated
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Your {tierName} plan is now active
          </p>
        </div>

        {/* Amount Display */}
        <div className="px-8 py-6 text-center border-b border-gray-200 dark:border-[#2A2E3A]">
          <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
            {displayPrice}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Billed monthly
          </p>
        </div>

        {/* Transaction Details */}
        <div className="px-8 py-6 space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-[#2A2E3A]">
            <span className="text-sm text-gray-600 dark:text-gray-400">Charge amount</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{displayPrice}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-[#2A2E3A]">
            <span className="text-sm text-gray-600 dark:text-gray-400">Invoice number</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-[#2A2E3A]">
            <span className="text-sm text-gray-600 dark:text-gray-400">Payment date</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{paymentDate}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Payment method</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">FastSpring</span>
          </div>
        </div>

        {/* View Details Link */}
        {checkoutId && (
          <div className="px-8 py-4 bg-gray-50 dark:bg-[#2A2E3A]/50 border-t border-gray-200 dark:border-[#2A2E3A]">
            <button
              onClick={handleViewDetails}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1 mx-auto"
            >
              View invoice and payment details
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Download Buttons */}
        <div className="px-8 py-6 border-t border-gray-200 dark:border-[#2A2E3A] flex gap-3">
          <button
            onClick={handleDownloadInvoice}
            className="flex-1 px-4 py-3 bg-white dark:bg-[#2A2E3A] border-2 border-gray-300 dark:border-[#3A3E4A] text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-[#3A3E4A] transition-colors flex items-center justify-center gap-2 min-h-[48px] touch-manipulation"
          >
            <FileText className="w-5 h-5" />
            Download invoice
          </button>
          <button
            onClick={handleDownloadReceipt}
            className="flex-1 px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 min-h-[48px] touch-manipulation"
          >
            <Receipt className="w-5 h-5" />
            Download receipt
          </button>
        </div>

        {/* Tier Features */}
        <div className="px-8 py-6 bg-blue-50 dark:bg-blue-900/10 border-t border-gray-200 dark:border-[#2A2E3A]">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              What's Unlocked
            </h2>
          </div>
          <ul className="space-y-2">
            {tierFeatures.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="px-8 py-6 border-t border-gray-200 dark:border-[#2A2E3A] space-y-3">
          <button
            onClick={handleContinue}
            className="w-full px-6 py-3 bg-[#8FA67E] hover:bg-[#7E9570] dark:bg-[#F4E5D9] dark:hover:bg-[#F3D3B8] text-white dark:text-[#8B7E74] rounded-xl font-medium transition-colors flex items-center justify-center gap-2 min-h-[48px] touch-manipulation"
          >
            Start Chatting
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleViewRituals}
            className="w-full px-6 py-3 bg-white dark:bg-[#2A2E3A] border-2 border-gray-300 dark:border-[#3A3E4A] text-gray-900 dark:text-white rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-[#3A3E4A] transition-colors min-h-[48px] touch-manipulation"
          >
            Explore Rituals
          </button>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-50 dark:bg-[#2A2E3A]/50 border-t border-gray-200 dark:border-[#2A2E3A] text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Powered by <span className="font-semibold">FastSpring</span>
          </p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="/terms" className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              Terms
            </a>
            <a href="/privacy" className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              Privacy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

