import { AnimatePresence, motion } from 'framer-motion';
import { Image, Loader2, Lock, Mic, X } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

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
  const [loading, setLoading] = useState<'core' | 'studio' | null>(null);

  const handleUpgrade = async (tier: 'core' | 'studio') => {
    try {
      setLoading(tier);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not logged in");

      const { error } = await supabase
        .from("profiles")
        .update({ subscription_tier: tier })
        .eq("id", user.id);

      if (error) throw error;
      console.log(`[UpgradeModal] ✅ Upgraded to ${tier}`);
      onClose();
      window.location.reload();
    } catch (err) {
      console.error("[UpgradeModal] ❌ Upgrade failed:", err);
      toast.error("Upgrade failed. Please try again.");
    } finally {
      setLoading(null);
    }
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
                  disabled={loading !== null}
                  className="flex-1 px-4 py-2 rounded-xl bg-[#B2BDA3] text-white font-medium hover:opacity-90 flex items-center justify-center"
                  onClick={() => handleUpgrade("core")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  {loading === "core" ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    "Upgrade to Core"
                  )}
                </motion.button>
                
                <motion.button
                  disabled={loading !== null}
                  className="flex-1 px-4 py-2 rounded-xl bg-[#F4E5D9] text-gray-900 font-medium hover:opacity-90 flex items-center justify-center"
                  onClick={() => handleUpgrade("studio")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  {loading === "studio" ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    "Upgrade to Studio"
                  )}
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