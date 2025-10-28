import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, TrendingUp, X } from 'lucide-react';
import { useEffect } from 'react';

interface RitualRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  ritualData: {
    title: string;
    durationMinutes: number;
    moodBefore: string;
    moodAfter: string;
    reflection: string;
  };
  onViewInsights: () => void;
  onStartAnother: () => void;
  autoDismiss?: boolean; // Optional auto-dismiss after 7s
}

export function RitualRewardModal({
  isOpen,
  onClose,
  ritualData,
  onViewInsights,
  onStartAnother,
  autoDismiss = false
}: RitualRewardModalProps) {
  
  // ✅ BEST PRACTICE #1: Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // ✅ BEST PRACTICE #2: ESC key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // ✅ BEST PRACTICE #3: Optional auto-dismiss
  useEffect(() => {
    if (!isOpen || !autoDismiss) return;
    const timer = setTimeout(() => {
      onClose();
    }, 7000);
    return () => clearTimeout(timer);
  }, [isOpen, autoDismiss, onClose]);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-md bg-[#F9F6F3] rounded-3xl shadow-2xl border border-[#E8DDD2] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#F0E6DC] hover:bg-[#E8DDD2] transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-[#8B7E74]" />
            </button>

            {/* Content */}
            <div className="p-8 text-center">
              {/* Animated Icon */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#C8956A] to-[#B8855A] mb-4"
              >
                <Sparkles className="w-10 h-10 text-white" />
              </motion.div>

              <h2 className="text-3xl font-bold text-[#3B3632] mb-6">
                🧘‍♀️ Ritual Complete!
              </h2>

              {/* Stats */}
              <div className="space-y-3 mb-6 text-left bg-white/60 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⏱</span>
                  <div>
                    <p className="text-sm text-[#8B7E74]">Time</p>
                    <p className="text-lg font-semibold text-[#3B3632]">{ritualData.durationMinutes} minutes</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-2xl">😴</span>
                  <div className="flex-1">
                    <p className="text-sm text-[#8B7E74]">Mood Journey</p>
                    <p className="text-lg font-semibold text-[#3B3632]">
                      {ritualData.moodBefore} → {ritualData.moodAfter}
                    </p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>

                {ritualData.reflection && (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💭</span>
                    <div>
                      <p className="text-sm text-[#8B7E74]">Reflection</p>
                      <p className="text-sm italic text-[#3B3632]">"{ritualData.reflection}"</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Success Message */}
              <p className="text-center text-green-600 font-medium mb-6">
                ✨ Great work! Your ritual is logged and ready for insights.
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onViewInsights}
                  className="flex-1 py-3 bg-[#C8956A] text-white rounded-xl font-semibold hover:bg-[#B8855A] transition-all active:scale-95"
                >
                  View Insights
                </button>
                <button
                  onClick={onStartAnother}
                  className="flex-1 py-3 bg-white border-2 border-[#E8DDD2] text-[#3B3632] rounded-xl font-semibold hover:bg-[#F9F6F3] transition-all active:scale-95"
                >
                  Start Another
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

