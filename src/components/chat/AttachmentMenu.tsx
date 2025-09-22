import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ImageIcon, Mic, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { featureService } from '../../services/featureService';
import { useTierAccess } from '../../hooks/useTierAccess';

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onPhotoSelect?: () => void;
  onImageSelect?: () => void;
  onMicSelect?: () => void;
}

export default function AttachmentMenu({ 
  visible, 
  onClose, 
  onPhotoSelect,
  onImageSelect,
  onMicSelect 
}: AttachmentMenuProps) {
  const { user } = useSupabaseAuth();
  const { canUseFeature, showUpgradeModal } = useTierAccess();

  const handleFeaturePress = async (feature: 'photo' | 'image' | 'mic') => {
    if (!user) {
      toast.error('Please log in to use this feature');
      return;
    }

    const canUse = canUseFeature(feature === 'photo' || feature === 'image' ? 'image' : 'audio');
    
    // Log the attempt
    await featureService.logAttempt(user.id, feature, canUse, !canUse);
    
    if (!canUse) {
      showUpgradeModal(feature === 'photo' || feature === 'image' ? 'image' : 'audio');
      onClose();
      return;
    }

    // Success - trigger the appropriate handler
    if (feature === 'photo' && onPhotoSelect) {
      onPhotoSelect();
    } else if (feature === 'image' && onImageSelect) {
      onImageSelect();
    } else if (feature === 'mic' && onMicSelect) {
      onMicSelect();
    }
    
    onClose();
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-t-2xl p-6 w-full max-w-md"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Add Attachment</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Options */}
          <div className="space-y-4">
            {/* Photo (Camera) */}
            <motion.button
              onClick={() => handleFeaturePress('photo')}
              className="w-full flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-50 transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              <div className="p-3 rounded-full bg-blue-100">
                <Camera size={24} className="text-blue-600" />
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">Take Photo</div>
                <div className="text-sm text-gray-500">Use camera to capture image</div>
              </div>
            </motion.button>

            {/* Image (Gallery) */}
            <motion.button
              onClick={() => handleFeaturePress('image')}
              className="w-full flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-50 transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              <div className="p-3 rounded-full bg-green-100">
                <ImageIcon size={24} className="text-green-600" />
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">Choose Image</div>
                <div className="text-sm text-gray-500">Select from gallery or files</div>
              </div>
            </motion.button>

            {/* Mic (Voice) */}
            <motion.button
              onClick={() => handleFeaturePress('mic')}
              className="w-full flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-50 transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              <div className="p-3 rounded-full bg-purple-100">
                <Mic size={24} className="text-purple-600" />
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">Voice Recording</div>
                <div className="text-sm text-gray-500">Record audio message</div>
              </div>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
