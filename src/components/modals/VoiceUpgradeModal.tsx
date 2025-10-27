import { AnimatePresence, motion } from 'framer-motion';
import { Check, Mic, Phone, Sparkles, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useTierAccess } from '../../hooks/useTierAccess';
import { logger } from '../../lib/logger';

interface VoiceUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTier?: 'core' | 'studio'; // ✅ NEW: Allow specifying which tier to show
  feature?: 'voice_calls' | 'audio' | 'image'; // ✅ NEW: Feature context
}

export default function VoiceUpgradeModal({ isOpen, onClose, defaultTier = 'studio', feature = 'voice_calls' }: VoiceUpgradeModalProps) {
  const { user } = useSupabaseAuth();
  const { tier } = useTierAccess();
  const [isVisible, setIsVisible] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'core' | 'studio'>(defaultTier);

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

  const handleUpgrade = async (targetTier?: 'core' | 'studio') => {
    if (!user?.id || !user?.email) {
      toast.error('Please log in to upgrade');
      return;
    }

    // Use selected tier or fallback to default
    const upgradeToTier = targetTier || selectedTier;

    try {
      // Show loading toast
      const loadingToast = toast.loading('Opening secure checkout...');
      
      const { fastspringService } = await import('../../services/fastspringService');
      const checkoutUrl = await fastspringService.createCheckoutUrl(
        user.id,
        upgradeToTier,
        user.email
      );
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // ✅ BEST PRACTICE: Log checkout URL for debugging
      logger.info(`Redirecting to FastSpring checkout for ${upgradeToTier}:`, checkoutUrl);
      
      // External checkout URL - full page navigation is acceptable here
      window.location.href = checkoutUrl;
    } catch (error) {
      logger.error('Upgrade error:', error);
      
      // ✅ BEST PRACTICE: User-friendly error with actionable guidance
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(
        `${errorMessage}\n\nPlease contact support if this persists.`,
        { duration: 5000 }
      );
    }
  };

  // ✅ Dynamic content based on feature
  const getModalContent = () => {
    if (feature === 'voice_calls') {
      return {
        title: 'Unlock Unlimited Voice Calls',
        subtitle: 'Experience real-time AI conversations with Atlas Studio',
        defaultTier: 'studio' as const,
        showBothPlans: true, // Voice calls = Studio, but show Core as alternative
      };
    } else {
      return {
        title: feature === 'audio' ? 'Unlock Voice Features' : 'Unlock Image Analysis',
        subtitle: feature === 'audio' 
          ? 'Record voice notes and get transcriptions with Atlas Core' 
          : 'Upload images and get AI-powered analysis with Atlas Core',
        defaultTier: 'core' as const,
        showBothPlans: true, // Show both options for flexibility
      };
    }
  };

  const modalContent = getModalContent();

  const benefits = [
    {
      icon: Phone,
      title: feature === 'voice_calls' ? 'Unlimited Duration' : 'Voice Recording',
      description: feature === 'voice_calls' 
        ? 'Talk as long as you need - no time limits' 
        : 'Record and transcribe voice messages',
    },
    {
      icon: Zap,
      title: feature === 'voice_calls' ? 'Real-Time Processing' : 'Unlimited Messages',
      description: feature === 'voice_calls'
        ? 'Natural, flowing conversations with instant responses'
        : 'No daily message limits - chat as much as you need',
    },
    {
      icon: Sparkles,
      title: 'Advanced AI Model',
      description: selectedTier === 'studio' 
        ? 'Claude Opus for deeper emotional intelligence' 
        : 'Claude Sonnet for high-quality responses',
    },
    {
      icon: Mic,
      title: feature === 'image' ? 'Image Analysis' : 'Priority Processing',
      description: feature === 'image'
        ? 'Upload and analyze images with AI'
        : selectedTier === 'studio' ? 'Faster response times than text conversations' : 'Full access to voice and image features',
    },
  ];

  const comparison = [
    { feature: 'Voice Calls', free: '❌', core: '❌', studio: '✅ Unlimited' },
    { feature: 'Call Duration', free: '—', core: '—', studio: 'No limits' },
    { feature: 'AI Model', free: 'Haiku', core: 'Sonnet', studio: 'Opus' },
    { feature: 'Processing Speed', free: 'Standard', core: 'Standard', studio: 'Priority' },
  ];

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-[#F9F6F3] rounded-3xl shadow-2xl border border-[#E8DDD2] overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full bg-[#F0E6DC] hover:bg-[#E8DDD2] transition-colors z-10"
            >
              <X className="w-5 h-5 text-[#8B7E74]" />
            </button>

            {/* Hero Section */}
            <div className="relative bg-gradient-to-br from-[#8FA67E]/10 to-[#C6D4B0]/10 p-12 text-center border-b border-[#E8DDD2]">
              {/* Animated Microphone */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-[#8FA67E] to-[#C6D4B0] mb-6 shadow-lg shadow-[#8FA67E]/50"
              >
                <Mic className="w-12 h-12 text-white" />
              </motion.div>

              <h2 className="text-4xl font-bold text-[#3B3632] mb-3">
                {modalContent.title}
              </h2>
              <p className="text-xl text-[#8B7E74] max-w-lg mx-auto">
                {modalContent.subtitle}
              </p>

              {/* Current Tier Badge */}
              {tier && (
                <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-white/50 rounded-full border border-[#E8DDD2]">
                  <span className="text-sm text-[#8B7E74]">Currently on:</span>
                  <span className="text-sm font-semibold text-[#3B3632] capitalize">
                    Atlas {tier}
                  </span>
                </div>
              )}
            </div>

            {/* Benefits Grid */}
            <div className="p-8 bg-white/50">
              <h3 className="text-2xl font-bold text-[#3B3632] mb-6 text-center">
                What You'll Get
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4 p-4 bg-white rounded-xl border border-[#E8DDD2] hover:border-[#8FA67E]/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-[#8FA67E]/20 to-[#C6D4B0]/20 flex items-center justify-center">
                      <benefit.icon className="w-6 h-6 text-[#8FA67E]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#3B3632] mb-1">
                        {benefit.title}
                      </h4>
                      <p className="text-sm text-[#8B7E74]">
                        {benefit.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Comparison Table */}
            <div className="p-8 bg-[#F0E6DC]/30">
              <h3 className="text-2xl font-bold text-[#3B3632] mb-6 text-center">
                Compare Tiers
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E8DDD2]">
                      <th className="text-left py-3 px-4 text-[#8B7E74] font-medium">
                        Feature
                      </th>
                      <th className="text-center py-3 px-4 text-[#8B7E74] font-medium">
                        Free
                      </th>
                      <th className="text-center py-3 px-4 text-[#8B7E74] font-medium">
                        Core
                      </th>
                      <th className="text-center py-3 px-4 text-[#8FA67E] font-semibold">
                        Studio
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row, index) => (
                      <tr
                        key={index}
                        className="border-b border-[#E8DDD2]/50 hover:bg-[#F0E6DC]/20"
                      >
                        <td className="py-3 px-4 text-[#5A524A]">
                          {row.feature}
                        </td>
                        <td className="py-3 px-4 text-center text-[#B8A9A0]">
                          {row.free}
                        </td>
                        <td className="py-3 px-4 text-center text-[#B8A9A0]">
                          {row.core}
                        </td>
                        <td className="py-3 px-4 text-center text-[#8FA67E] font-medium">
                          {row.studio}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pricing & CTA */}
            <div className="p-8 bg-gradient-to-br from-[#8FA67E]/10 to-[#C6D4B0]/10 border-t border-[#E8DDD2]">
              {modalContent.showBothPlans ? (
                // Show both Core and Studio options
                <div className="space-y-4">
                  {/* Core Plan Option */}
                  {(feature === 'audio' || feature === 'image') && (
                    <div className={`border-2 rounded-xl p-6 transition-all ${
                      selectedTier === 'core' ? 'border-[#8FA67E] bg-[#8FA67E]/5' : 'border-[#E8DDD2] bg-white'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-[#3B3632]">Core</h3>
                          <p className="text-sm text-[#8B7E74]">Voice & Image Features</p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-[#3B3632]">$19.99</div>
                          <div className="text-sm text-[#8B7E74]">/month</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUpgrade('core')}
                        className="w-full py-3 bg-gradient-to-r from-[#8FA67E] to-[#C6D4B0] hover:from-[#7E9570] hover:to-[#B8C6A2] text-white font-bold text-lg rounded-xl shadow-lg transition-all transform hover:scale-105"
                      >
                        Upgrade to Core
                      </button>
                    </div>
                  )}

                  {/* Studio Plan Option */}
                  <div className={`border-2 rounded-xl p-6 transition-all ${
                    selectedTier === 'studio' ? 'border-[#8FA67E] bg-[#8FA67E]/5' : 'border-[#E8DDD2] bg-white'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-[#3B3632]">Studio</h3>
                        <p className="text-sm text-[#8B7E74]">
                          {feature === 'voice_calls' ? 'Unlimited Voice Calls + Everything' : 'Everything in Core + Voice Calls'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-[#3B3632]">$179.99</div>
                        <div className="text-sm text-[#8B7E74]">/month</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpgrade('studio')}
                      className="w-full py-3 bg-gradient-to-r from-[#8FA67E] to-[#C6D4B0] hover:from-[#7E9570] hover:to-[#B8C6A2] text-white font-bold text-lg rounded-xl shadow-lg transition-all transform hover:scale-105"
                    >
                      Upgrade to Studio
                    </button>
                  </div>
                </div>
              ) : (
                // Single plan layout (legacy)
                <div className="max-w-md mx-auto">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-[#3B3632]">
                        {selectedTier === 'studio' ? '$179.99' : '$19.99'}
                      </span>
                      <span className="text-[#8B7E74]">/month</span>
                    </div>
                    <p className="text-sm text-[#8B7E74] mt-2">
                      Cancel anytime • Secure payment
                    </p>
                  </div>

                  <button
                    onClick={() => handleUpgrade()}
                    className="w-full py-4 bg-gradient-to-r from-[#8FA67E] to-[#C6D4B0] hover:from-[#7E9570] hover:to-[#B8C6A2] text-white font-bold text-lg rounded-xl shadow-lg shadow-[#8FA67E]/30 transition-all transform hover:scale-105"
                  >
                    Upgrade to {selectedTier === 'studio' ? 'Studio' : 'Core'}
                  </button>
                </div>
              )}

              {/* Trust Badges */}
              <div className="flex items-center justify-center gap-6 mt-6 text-xs text-[#8B7E74]">
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#8FA67E]" />
                  <span>Secure Payment</span>
                </div>
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#8FA67E]" />
                  <span>Cancel Anytime</span>
                </div>
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#8FA67E]" />
                  <span>Money-Back Guarantee</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

