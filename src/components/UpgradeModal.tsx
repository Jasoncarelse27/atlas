import { AnimatePresence, motion } from 'framer-motion';
import { Image, Lock, Mic, X } from 'lucide-react';
import React from 'react';
import { toast } from 'react-hot-toast';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'voice' | 'image';
  onUpgrade?: () => void;
  onUpgradeSuccess?: () => void;
  userTier?: 'free' | 'core' | 'studio';
}

const featureConfig = {
  voice: {
    icon: Mic,
    title: 'Voice Recording',
    description: 'Voice recording is available for Core/Studio users. Upgrade to unlock this feature!',
    benefits: ['Record voice messages', 'AI voice transcription', 'Hands-free chatting']
  },
  image: {
    icon: Image,
    title: 'Image Upload',
    description: 'Image upload and analysis is available for Core/Studio users. Upgrade to unlock this feature!',
    benefits: ['Upload images', 'AI image analysis', 'Visual context understanding']
  }
};

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  feature,
  onUpgrade,
  onUpgradeSuccess,
  userTier = 'free'
}) => {
  const config = featureConfig[feature];

  const handleUpgrade = () => {
    // TODO: Integrate with Paddle checkout
    console.log(`Upgrade to Core/Studio for ${feature} features`);
    
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Default upgrade action - could redirect to Paddle
      window.open('https://atlas-ai.com/pricing', '_blank');
    }
    
    // Simulate successful upgrade for demo purposes
    // In real implementation, this would be called after Paddle success
    setTimeout(() => {
      // Determine target tier based on feature
      const targetTier = feature === 'voice' ? 'core' : 'studio';
      
      // Feature-specific toast notification with retry action
      const featureMessage =
        feature === "voice"
          ? "You can now record and transcribe voice messages"
          : feature === "image"
          ? "You can now upload and analyze images"
          : "Your premium features are unlocked";

      toast.success(
        `Upgrade successful! Welcome to ${
          targetTier === "core" ? "Core" : "Studio"
        }. ${featureMessage}`,
        {
          duration: 5000,
          action: {
            label: "Try again now",
            onClick: () => {
              if (typeof onUpgradeSuccess === "function") {
                onUpgradeSuccess();
              }
            },
          },
        }
      );
    }, 1500); // Simulate processing time
    
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md bg-gray-800 rounded-xl border border-gray-700 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Lock className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex items-center gap-2">
                  <config.icon className="w-5 h-5 text-blue-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Upgrade Required
                    </h2>
                    <p className="text-sm text-gray-400">
                      {config.title}
                    </p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
              <p className="text-gray-300 mb-4">
                {config.description}
              </p>

              {/* Benefits */}
              <div className="space-y-2 mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  What you'll get:
                </h3>
                {config.benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                    <span className="text-sm text-gray-300">{benefit}</span>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <motion.button
                  onClick={handleUpgrade}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  Upgrade Now
                </motion.button>
                
                <motion.button
                  onClick={onClose}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-4 rounded-lg transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  Cancel
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpgradeModal;