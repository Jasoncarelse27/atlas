import { createPopper } from '@popperjs/core';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useTierAccess } from '../../hooks/useTierAccess';
import { featureService } from '../../services/featureService';

interface AttachmentMenuProps {
  anchorRef: React.RefObject<HTMLButtonElement>;
  onClose: () => void;
}

export default function AttachmentMenu({ anchorRef, onClose }: AttachmentMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [popperInstance, setPopperInstance] = useState<any>(null);
  const { canUseFeature, showUpgradeModal } = useTierAccess();
  const { user } = useSupabaseAuth();

  useEffect(() => {
    if (anchorRef.current && menuRef.current) {
      const instance = createPopper(anchorRef.current, menuRef.current, {
        placement: 'top', // Always position above the button
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, 8], // 8px gap from the button
            },
          },
        ],
      });
      setPopperInstance(instance);

      // Cleanup function
      return () => {
        if (instance) {
          instance.destroy();
        }
      };
    }
  }, [anchorRef]);

  // Handle click outside and escape key to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Add event listeners when component mounts
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    // Cleanup event listeners when component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose, anchorRef]);

  const handleFeatureClick = async (feature: 'image' | 'camera' | 'audio') => {
    if (!user) {
      toast.error('Please log in to use this feature');
      return;
    }

    const canUse = canUseFeature(feature);
    
    // Log the attempt
    await featureService.logAttempt(user.id, feature, canUse, !canUse);
    
    if (!canUse) {
      toast.error(`${feature} features are available in Core & Studio plans. Upgrade to unlock!`);
      showUpgradeModal(feature);
      return;
    }

    // Feature-specific logic
    switch (feature) {
      case 'image':
        toast.success('Image picker opened (feature coming soon)');
        break;
      case 'camera':
        toast.success('Camera access requested (feature coming soon)');
        break;
      case 'audio':
        toast.success('Voice recording started (feature coming soon)');
        break;
    }

    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="z-50 bg-gray-900 rounded-lg shadow-lg border border-gray-700 p-2 flex flex-col min-w-[200px]"
        style={{ 
          position: 'absolute',
          // Popper.js will handle positioning via the ref
        }}
      >
        <button
          onClick={() => handleFeatureClick('image')}
          className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3"
        >
          <span className="text-xl">📎</span>
          <span>Add Photo</span>
        </button>
        
        <button
          onClick={() => handleFeatureClick('camera')}
          className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3"
        >
          <span className="text-xl">📷</span>
          <span>Take Photo</span>
        </button>
        
        <button
          onClick={() => handleFeatureClick('audio')}
          className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3"
        >
          <span className="text-xl">🎤</span>
          <span>Record Audio</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}