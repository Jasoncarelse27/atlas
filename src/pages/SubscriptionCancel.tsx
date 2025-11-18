/**
 * Subscription Cancel Page
 * Shown when user cancels FastSpring checkout
 * 
 * Features:
 * - Explains cancellation
 * - Provides upgrade options
 * - Mobile-responsive design
 */

import { XCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import EnhancedUpgradeModal from '../components/EnhancedUpgradeModal';
import { useState } from 'react';

export default function SubscriptionCancel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleBackToChat = () => {
    navigate('/chat');
  };

  const handleTryAgain = () => {
    setShowUpgradeModal(true);
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-atlas-pearl dark:bg-[#0F121A] flex items-center justify-center safe-top safe-bottom px-4">
      <div className="max-w-md w-full bg-white dark:bg-[#1A1D26] rounded-2xl shadow-xl border border-atlas-border dark:border-[#2A2E3A] p-8 text-center">
        {/* Cancel Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <XCircle className="w-12 h-12 text-orange-600 dark:text-orange-400" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-3xl font-bold text-atlas-text-dark dark:text-white mb-3">
          Checkout Cancelled
        </h1>
        <p className="text-atlas-text-medium dark:text-gray-300 mb-6">
          No worries! You can upgrade anytime to unlock advanced features.
        </p>

        {/* Benefits Reminder */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-6 text-left">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-atlas-text-dark dark:text-white">
              What You're Missing
            </h2>
          </div>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-atlas-text-medium dark:text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              Unlimited conversations
            </li>
            <li className="flex items-center gap-2 text-sm text-atlas-text-medium dark:text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              Voice & image analysis
            </li>
            <li className="flex items-center gap-2 text-sm text-atlas-text-medium dark:text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              Custom ritual builder
            </li>
            <li className="flex items-center gap-2 text-sm text-atlas-text-medium dark:text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              Advanced AI models
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleTryAgain}
            className="w-full px-6 py-3 bg-[#8FA67E] hover:bg-[#7E9570] dark:bg-[#F4E5D9] dark:hover:bg-[#F3D3B8] text-white dark:text-[#8B7E74] rounded-xl font-medium transition-colors flex items-center justify-center gap-2 min-h-[48px] touch-manipulation"
          >
            Try Again
            <Sparkles className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleBackToChat}
            className="w-full px-6 py-3 bg-white dark:bg-[#2A2E3A] border-2 border-atlas-border dark:border-[#2A2E3A] text-atlas-text-dark dark:text-white rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-[#3A3E4A] transition-colors flex items-center justify-center gap-2 min-h-[48px] touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Chat
          </button>
        </div>

        {/* Help Text */}
        <p className="mt-6 text-xs text-atlas-text-muted dark:text-gray-400">
          Questions? Contact support at{' '}
          <a 
            href="mailto:support@atlasai.app" 
            className="text-atlas-sage dark:text-[#F4E5D9] hover:underline"
          >
            support@atlasai.app
          </a>
        </p>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <EnhancedUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}

