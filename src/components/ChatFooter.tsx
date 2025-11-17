import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isPaidTier, isStudioTier } from '../config/featureAccess';
import { useUsageIndicator } from '../hooks/useUsageIndicator';

interface ChatFooterProps {
  onUpgradeClick?: () => void;
  className?: string;
}

/**
 * Chat footer component that displays usage statistics and tier information
 * Shows remaining messages for free users and tier status for paid users
 */
export const ChatFooter: React.FC<ChatFooterProps> = ({ 
  onUpgradeClick,
  className = '' 
}) => {
  const navigate = useNavigate();
  const {
    usage,
    loading,
    error,
    getDisplayText,
    getDisplayClasses,
    shouldShowUpgradePrompt,
    refreshUsage,
  } = useUsageIndicator();

  const handleUpgradeClick = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      // Default behavior: trigger global upgrade modal (no page reload)
      if (typeof window !== 'undefined' && (window as any).showUpgradeModal) {
        (window as any).showUpgradeModal();
      } else {
        // ✅ FIX: Use React Router navigation instead of hard reload
        navigate('/upgrade', { replace: true });
      }
    }
  };

  return (
    <div className={`flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Usage Indicator */}
      <div className="flex items-center space-x-2">
        <div className={`text-sm ${getDisplayClasses()}`}>
          {getDisplayText()}
        </div>
        
        {/* Refresh Button */}
        <button
          onClick={refreshUsage}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          title="Refresh usage"
        >
          <svg 
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
        </button>
      </div>

      {/* Upgrade Button (shown for free users with low messages) */}
      {shouldShowUpgradePrompt() && (
        <button
          onClick={handleUpgradeClick}
          className="px-3 py-1.5 text-xs font-medium text-white bg-atlas-sage hover:bg-atlas-success dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          Upgrade
        </button>
      )}

      {/* Tier Badge for Paid Users */}
      {usage && !loading && !error && isPaidTier(usage.tier) && (
        <div className="flex items-center space-x-2">
          <div className={`px-2 py-1 text-xs font-medium rounded-full ${
            usage.tier === 'core' 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
              : isStudioTier(usage.tier)
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
          }`}>
            {usage.tier === 'core' ? '🌱 Core' : isStudioTier(usage.tier) ? '🚀 Studio' : 'Free'}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-xs text-red-500 dark:text-red-400">
          Usage data unavailable
        </div>
      )}
    </div>
  );
};

export default ChatFooter;
