import { AnimatePresence, motion } from 'framer-motion';
import { Image, Mic, Sparkles, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSimpleTier } from '../hooks/useSimpleTier';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';

interface EnhancedUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
}

export default function EnhancedUpgradeModal({ isOpen, onClose, feature }: EnhancedUpgradeModalProps) {
  const { user } = useSupabaseAuth();
  const { tier, loading, error } = useSimpleTier();
  
  // Simple upgrade modal handler
  const showUpgradeModal = (feature: string) => {
    console.log(`⚠️ Upgrade required for: ${feature}`);
  };
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleUpgrade = (tier: 'core' | 'studio') => {
    // TODO: Integrate with Paddle checkout
    console.log(`Upgrading to ${tier} tier`);
    onClose();
  };

  const features = {
    core: [
      { icon: Mic, text: 'Voice recording & transcription', available: true },
      { icon: Image, text: 'Image upload & analysis', available: true },
      { icon: Zap, text: 'Unlimited messages', available: true },
      { icon: Sparkles, text: 'Claude Sonnet model', available: true },
    ],
    studio: [
      { icon: Mic, text: 'Advanced voice features', available: true },
      { icon: Image, text: 'High-res image analysis', available: true },
      { icon: Zap, text: 'Priority processing', available: true },
      { icon: Sparkles, text: 'Claude Opus model', available: true },
    ]
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md mx-4 bg-gray-900 rounded-2xl shadow-2xl border border-gray-700"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B2BDA3] to-[#F4E5D9] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-gray-800" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Upgrade Atlas</h2>
                  <p className="text-sm text-gray-400">Unlock premium features</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Feature Context */}
              {feature && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-300">
                    <strong>{feature}</strong> features are available with Core & Studio plans
                  </p>
                </div>
              )}

              {/* Pricing Cards */}
              <div className="space-y-4">
                {/* Core Plan */}
                <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-[#B2BDA3]/30 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">Core</h3>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">$19.99</div>
                      <div className="text-sm text-gray-400">/month</div>
                    </div>
                  </div>
                  
                  <ul className="space-y-2 mb-4">
                    {features.core.map((feature, index) => (
                      <li key={index} className="flex items-center space-x-3 text-sm">
                        <feature.icon className="w-4 h-4 text-[#B2BDA3]" />
                        <span className="text-gray-300">{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={() => handleUpgrade('core')}
                    className="w-full py-3 bg-[#B2BDA3] hover:bg-[#B2BDA3]/80 text-gray-900 font-semibold rounded-lg transition-colors"
                  >
                    Upgrade to Core
                  </button>
                </div>

                {/* Studio Plan */}
                <div className="p-4 bg-gradient-to-br from-[#B2BDA3]/10 to-[#F4E5D9]/10 rounded-xl border border-[#B2BDA3]/30 hover:border-[#B2BDA3]/50 transition-colors relative">
                  <div className="absolute -top-2 left-4 px-3 py-1 bg-[#B2BDA3] text-gray-900 text-xs font-semibold rounded-full">
                    Most Popular
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">Studio</h3>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">$179.99</div>
                      <div className="text-sm text-gray-400">/month</div>
                    </div>
                  </div>
                  
                  <ul className="space-y-2 mb-4">
                    {features.studio.map((feature, index) => (
                      <li key={index} className="flex items-center space-x-3 text-sm">
                        <feature.icon className="w-4 h-4 text-[#F4E5D9]" />
                        <span className="text-gray-300">{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={() => handleUpgrade('studio')}
                    className="w-full py-3 bg-gradient-to-r from-[#B2BDA3] to-[#F4E5D9] hover:from-[#B2BDA3]/80 hover:to-[#F4E5D9]/80 text-gray-900 font-semibold rounded-lg transition-colors"
                  >
                    Upgrade to Studio
                  </button>
                </div>
              </div>

              {/* Footer */}
              <p className="text-xs text-gray-500 text-center">
                All plans include secure payment processing and can be cancelled anytime
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}