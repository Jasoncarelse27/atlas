import { AnimatePresence, motion } from 'framer-motion';
import { Check, Mic, Phone, Sparkles, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useTierAccess } from '../../hooks/useTierAccess';

interface VoiceUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceUpgradeModal({ isOpen, onClose }: VoiceUpgradeModalProps) {
  const { user } = useSupabaseAuth();
  const { tier } = useTierAccess();
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

  const handleUpgrade = async () => {
    if (!user?.id || !user?.email) return;

    try {
      const { fastspringService } = await import('../../services/fastspringService');
      const checkoutUrl = await fastspringService.createCheckoutUrl(
        user.id,
        'studio',
        user.email
      );
      // External checkout URL - full page navigation is acceptable here
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Upgrade error:', error);
    }
  };

  const benefits = [
    {
      icon: Phone,
      title: 'Unlimited Duration',
      description: 'Talk as long as you need - no time limits',
    },
    {
      icon: Zap,
      title: 'Real-Time Processing',
      description: 'Natural, flowing conversations with instant responses',
    },
    {
      icon: Sparkles,
      title: 'Advanced AI Model',
      description: 'Claude Opus for deeper emotional intelligence',
    },
    {
      icon: Mic,
      title: 'Priority Processing',
      description: 'Faster response times than text conversations',
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
                Unlock Unlimited Voice Calls
              </h2>
              <p className="text-xl text-[#8B7E74] max-w-lg mx-auto">
                Experience real-time AI conversations with Atlas Studio
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
              <div className="max-w-md mx-auto">
                <div className="text-center mb-6">
                  <div className="inline-flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-[#3B3632]">$189.99</span>
                    <span className="text-[#8B7E74]">/month</span>
                  </div>
                  <p className="text-sm text-[#8B7E74] mt-2">
                    Cancel anytime • Secure payment
                  </p>
                </div>

                <button
                  onClick={handleUpgrade}
                  className="w-full py-4 bg-gradient-to-r from-[#8FA67E] to-[#C6D4B0] hover:from-[#7E9570] hover:to-[#B8C6A2] text-white font-bold text-lg rounded-xl shadow-lg shadow-[#8FA67E]/30 transition-all transform hover:scale-105"
                >
                  Upgrade to Studio
                </button>

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
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

