import React from 'react';
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
      // Default behavior: trigger global upgrade modal
      if (typeof window !== 'undefined' && (window as any).showUpgradeModal) {
        (window as any).showUpgradeModal();
      } else {
        // Fallback: redirect to upgrade page
        window.location.href = '/upgrade';
      }
    }
  };

  return (
    <div className={`flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 ${className}`}>
      {/* Usage Indicator */}
      <div className="flex items-center space-x-2">
        <div className={`text-sm ${getDisplayClasses()}`}>
          {getDisplayText()}
        </div>
        
        {/* Refresh Button */}
        <button
          onClick={refreshUsage}
          className="text-gray-400 hover:text-gray-600 transition-colors"
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
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          Upgrade
        </button>
      )}

      {/* Tier Badge for Paid Users */}
      {usage && !loading && !error && (usage.tier === 'core' || usage.tier === 'studio') && (
        <div className="flex items-center space-x-2">
          <div className={`px-2 py-1 text-xs font-medium rounded-full ${
            usage.tier === 'core' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-purple-100 text-purple-800'
          }`}>
            {usage.tier === 'core' ? '🌱 Core' : '🚀 Studio'}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-xs text-red-500">
          ⚠️ Usage data unavailable
        </div>
      )}
    </div>
  );
};

export default ChatFooter;
