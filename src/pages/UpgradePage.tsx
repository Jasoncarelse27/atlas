import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import EnhancedUpgradeModal from "../components/EnhancedUpgradeModal";
import { useAuth } from "../providers/AuthProvider";

export default function UpgradePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(true);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleBackToChat = () => {
    navigate("/chat");
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-4">
        {/* Back to Chat Button */}
        <div className="mb-6">
          <button
            onClick={handleBackToChat}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Chat
          </button>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Upgrade Your Atlas Plan
        </h1>
        <p className="text-gray-400 mb-8 text-lg">
          Unlock advanced features like image analysis, voice recording, and unlimited conversations
        </p>
        
        <EnhancedUpgradeModal 
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            // Don't navigate away immediately - let user decide
          }}
        />
        
        {/* Additional Back Option */}
        <div className="mt-8">
          <button
            onClick={handleBackToChat}
            className="text-gray-500 hover:text-gray-300 text-sm underline transition-colors"
          >
            Continue with current plan
          </button>
        </div>
      </div>
    </div>
  );
}
