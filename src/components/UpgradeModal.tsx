
interface UpgradeModalProps {
  isVisible: boolean;
  onClose: () => void;
  reason?: string;
  currentUsage?: number;
  limit?: number;
}

export default function UpgradeModal({ 
  isVisible, 
  onClose, 
  reason = 'monthly limit',
  currentUsage,
  limit 
}: UpgradeModalProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#2c2f36] rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚡</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Upgrade Required
            </h2>
            <p className="text-gray-300 mb-4">
              You've reached your {reason}. Continue your journey with Atlas by upgrading to unlock unlimited conversations and advanced features.
            </p>
            
            {currentUsage && limit && (
              <div className="bg-gray-700 rounded-lg p-3 mb-4">
                <div className="flex justify-between text-sm text-gray-300 mb-2">
                  <span>Messages This Month</span>
                  <span>{currentUsage} / {limit}</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full"
                    style={{ width: `${(currentUsage / limit) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                // TODO: Implement upgrade flow
                window.open('/upgrade', '_blank');
              }}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Upgrade to Atlas Core - $19.99/month
            </button>
            
            <button
              onClick={onClose}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-6 rounded-lg transition-colors"
            >
              Maybe Later
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Atlas Core includes unlimited messages, voice features, and Claude Sonnet
          </p>
        </div>
      </div>
    </div>
  );
}