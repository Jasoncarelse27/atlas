import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ImageIcon, Mic } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useTierAccess } from '../../hooks/useTierAccess';
import { featureService } from '../../services/featureService';

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onPhotoSelect?: () => void;
  onImageSelect?: () => void;
  onMicSelect?: () => void;
  triggerPosition?: { x: number; y: number };
}

export default function AttachmentMenu({ 
  visible, 
  onClose, 
  onPhotoSelect,
  onImageSelect,
  onMicSelect,
  triggerPosition = { x: 0, y: 0 }
}: AttachmentMenuProps) {
  const { user } = useSupabaseAuth();
  const { canUseFeature, showUpgradeModal } = useTierAccess();

  // Debug logging
  console.log('📋 AttachmentMenu render:', { visible, triggerPosition });

  // Calculate responsive positioning
  const getMenuPosition = () => {
    const menuWidth = 320; // 320px (w-80)
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < 640; // sm breakpoint
    
    if (isMobile) {
      // On mobile, center the menu and position it above the trigger
      return {
        left: Math.max(16, Math.min(triggerPosition.x - (menuWidth / 2), viewportWidth - menuWidth - 16)),
        top: triggerPosition.y - 200,
      };
    } else {
      // On desktop, use the original positioning
      return {
        left: triggerPosition.x - 140,
        top: triggerPosition.y - 220,
      };
    }
  };

  const menuPosition = getMenuPosition();

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

  if (!visible) {
    console.log('📋 AttachmentMenu not visible, returning null');
    return null;
  }

  console.log('📋 AttachmentMenu rendering with visible=true');

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/30 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="absolute bg-gray-900 rounded-2xl p-4 shadow-2xl border border-gray-700 w-80 max-w-[calc(100vw-2rem)] sm:w-80"
          style={{
            left: `${menuPosition.left}px`,
            top: `${menuPosition.top}px`,
          }}
          initial={{ 
            scale: 0.3,
            opacity: 0,
            y: 30,
            transformOrigin: "bottom center"
          }}
          animate={{ 
            scale: 1,
            opacity: 1,
            y: 0
          }}
          exit={{ 
            scale: 0.3,
            opacity: 0,
            y: 30,
            transition: { duration: 0.15 }
          }}
          transition={{ 
            type: 'spring', 
            damping: 25, 
            stiffness: 300,
            duration: 0.2
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Options */}
          <div className="space-y-2">
            {/* Photo (Camera) */}
            <motion.button
              onClick={() => handleFeaturePress('photo')}
              className="w-full flex items-center space-x-3 p-4 rounded-lg hover:bg-gray-800 transition-colors touch-manipulation"
              whileTap={{ scale: 0.98 }}
            >
              <Camera size={20} className="text-gray-400" />
              <span className="text-gray-200">Add photos & files</span>
            </motion.button>

            {/* Image (Gallery) */}
            <motion.button
              onClick={() => handleFeaturePress('image')}
              className="w-full flex items-center space-x-3 p-4 rounded-lg hover:bg-gray-800 transition-colors touch-manipulation"
              whileTap={{ scale: 0.98 }}
            >
              <ImageIcon size={20} className="text-gray-400" />
              <span className="text-gray-200">Add from Google Drive</span>
            </motion.button>

            {/* Divider */}
            <div className="border-t border-gray-700 my-2"></div>

            {/* Deep research */}
            <motion.button
              onClick={() => handleFeaturePress('mic')}
              className="w-full flex items-center space-x-3 p-4 rounded-lg hover:bg-gray-800 transition-colors touch-manipulation"
              whileTap={{ scale: 0.98 }}
            >
              <Mic size={20} className="text-gray-400" />
              <span className="text-gray-200">Deep research</span>
            </motion.button>

            {/* Create image */}
            <motion.button
              onClick={() => handleFeaturePress('image')}
              className="w-full flex items-center space-x-3 p-4 rounded-lg hover:bg-gray-800 transition-colors touch-manipulation"
              whileTap={{ scale: 0.98 }}
            >
              <ImageIcon size={20} className="text-gray-400" />
              <span className="text-gray-200">Create image</span>
            </motion.button>

            {/* Agent mode */}
            <motion.button
              onClick={() => handleFeaturePress('mic')}
              className="w-full flex items-center space-x-3 p-4 rounded-lg hover:bg-gray-800 transition-colors touch-manipulation"
              whileTap={{ scale: 0.98 }}
            >
              <Mic size={20} className="text-gray-400" />
              <span className="text-gray-200">Agent mode</span>
            </motion.button>

            {/* Use connectors */}
            <motion.button
              onClick={() => handleFeaturePress('image')}
              className="w-full flex items-center space-x-3 p-4 rounded-lg hover:bg-gray-800 transition-colors touch-manipulation"
              whileTap={{ scale: 0.98 }}
            >
              <ImageIcon size={20} className="text-gray-400" />
              <span className="text-gray-200">Use connectors</span>
            </motion.button>

            {/* More */}
            <motion.button
              onClick={onClose}
              className="w-full flex items-center space-x-3 p-4 rounded-lg hover:bg-gray-800 transition-colors touch-manipulation"
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-gray-400">...</span>
              <span className="text-gray-200">More</span>
              <span className="text-gray-400 ml-auto">→</span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
