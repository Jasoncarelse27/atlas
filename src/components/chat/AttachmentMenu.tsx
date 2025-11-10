import { AnimatePresence, motion } from 'framer-motion';
import { Camera, FileUp, Image as ImageIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { useFileUpload } from '@/hooks/useFileUpload';
import { useFeatureAccess } from '@/hooks/useTierAccess';
import { logger } from '../../lib/logger';

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onAddAttachment?: (attachment: { id: string; type: string; url?: string; publicUrl?: string; file?: File }) => void;
}

/**
 * ✅ PREMIUM: Attachment Menu - Matching VoiceUpgradeModal Quality
 * - Premium grid layout (icon-first design)
 * - Animated icons with visual hierarchy
 * - Removed header/footer for efficiency
 * - Professional polish for paying users ($19.99-$149.99/month)
 */
const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  isOpen,
  onClose,
  userId,
  onAddAttachment,
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Tier access checks
  const { attemptFeature: attemptImage } = useFeatureAccess('image');
  const { attemptFeature: attemptCamera } = useFeatureAccess('camera');
  
  // ✅ MODERN: Unified upload hook
  const { uploadFile, isUploading } = useFileUpload({
    userId,
    onSuccess: (attachment) => {
      if (onAddAttachment) {
        onAddAttachment(attachment);
      }
      onClose();
    },
  });

  // ✅ MODERN: Unified handler - one function for all uploads
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, source: 'gallery' | 'camera' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear input for next selection
    e.target.value = '';
    
    // Check tier access
    const hasAccess = await attemptImage();
    if (!hasAccess) {
      return; // attemptImage already shows upgrade modal
    }

    try {
      await uploadFile(file, source);
    } catch (error) {
      // Error handling is done in useFileUpload hook
      logger.error('[AttachmentMenu] Upload failed:', error);
    }
  };

  const handleCameraClick = async () => {
    // Check tier access for camera
    const hasAccess = await attemptCamera();
    if (!hasAccess) {
      return; // attemptCamera already shows upgrade modal
    }
    cameraInputRef.current?.click();
  };

  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // ✅ MOBILE-FIRST: Calculate position - optimized for grid layout
  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    // ✅ FIX: Add small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const button = document.querySelector('[data-attachment-button]') as HTMLElement;
      if (!button) {
        // Fallback: Center on screen if button not found
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const menuWidth = window.matchMedia('(max-width: 639px)').matches ? 280 : 340;
        const menuHeight = window.matchMedia('(max-width: 639px)').matches ? 180 : 200;
        setMenuPosition({
          top: (viewportHeight - menuHeight) / 2,
          left: (viewportWidth - menuWidth) / 2
        });
        return;
      }

      const rect = button.getBoundingClientRect();
      // ✅ BEST PRACTICE: Use matchMedia for responsive breakpoint (matches Tailwind sm: 640px)
      const isMobile = window.matchMedia('(max-width: 639px)').matches;
      const menuWidth = isMobile ? 280 : 340; // ✅ PREMIUM: Compact grid layout
      const menuHeight = isMobile ? 180 : 200; // ✅ PREMIUM: Much smaller height
      const spacing = isMobile ? 8 : 12;
      const padding = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // ✅ MOBILE-FIRST: Position centered above input area
      let left = (viewportWidth - menuWidth) / 2; // Center horizontally
      let top: number;

      if (isMobile) {
        // Mobile: Position above the entire input area
        const inputArea = document.querySelector('[data-input-area]') as HTMLElement;
        if (inputArea) {
          const inputRect = inputArea.getBoundingClientRect();
          top = inputRect.top - menuHeight - spacing;
        } else {
          // Fallback: Use button position
          top = rect.top - menuHeight - spacing;
        }
      } else {
        // Desktop: Position above button, centered on button
        left = rect.left + (rect.width / 2) - (menuWidth / 2);
        top = rect.top - menuHeight - spacing;
      }

      // ✅ CRITICAL: Keep within viewport horizontally
      if (left < padding) left = padding;
      if (left + menuWidth > viewportWidth - padding) {
        left = viewportWidth - menuWidth - padding;
      }
        
      // ✅ CRITICAL: On mobile, if menu would go off-screen top, position it in visible area
      if (top < padding) {
        if (isMobile) {
          // Mobile: Position in middle-top area (20% from top) so it's always visible
          top = Math.max(padding, viewportHeight * 0.2);
          // Re-center horizontally when repositioned
          left = (viewportWidth - menuWidth) / 2;
        } else {
          // Desktop: Position below button if no space above
          top = rect.bottom + spacing;
        }
      }
        
      // ✅ CRITICAL: Ensure menu doesn't overflow bottom (especially important on mobile)
      const maxTop = viewportHeight - menuHeight - padding;
      if (top > maxTop) {
        top = Math.max(padding, maxTop);
        // Re-center horizontally when repositioned
        if (isMobile) {
          left = (viewportWidth - menuWidth) / 2;
        }
      }
        
      setMenuPosition({ top, left });
    }, 50); // ✅ Small delay to ensure DOM is ready
    
    return () => clearTimeout(timer);
  }, [isOpen]);

  // ✅ SIMPLIFIED: Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const button = document.querySelector('[data-attachment-button]');
      const menu = menuRef.current;
      
      if (menu && !menu.contains(target) && button && !button.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && menuPosition && (
        <>
          {/* Backdrop - ✅ FIX: Transparent to prevent blur artifacts */}
          <motion.div
            className="fixed inset-0 bg-transparent z-[10001]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
            style={{
              pointerEvents: 'auto',
              transform: 'translateZ(0)', // ✅ GPU acceleration
            }}
          />
          
          {/* Menu - ✅ PREMIUM: Grid layout matching VoiceUpgradeModal quality */}
          <motion.div
            ref={menuRef}
            data-attachment-menu
            className="fixed w-[280px] sm:w-[340px] max-w-[calc(100vw-16px)] z-[10003] rounded-3xl bg-gradient-to-br from-atlas-pearl to-atlas-peach shadow-2xl border-2 border-atlas-sand p-6 sm:p-8"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              boxShadow: '0 20px 60px rgba(151, 134, 113, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
            }}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.96 }}
            transition={{ 
              duration: 0.25, 
              ease: [0.16, 1, 0.3, 1], // ✅ BEST PRACTICE: Smooth easing curve
              scale: { duration: 0.2 }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hidden inputs - ✅ MODERN: Native inputs work everywhere now */}
            <input
              type="file"
              accept="image/*,video/*"
              ref={imageInputRef}
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e, 'gallery')}
              aria-label="Select images or videos from gallery"
              disabled={isUploading}
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e, 'camera')}
              aria-label="Take photo with camera"
              disabled={isUploading}
            />
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,audio/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e, 'file')}
              aria-label="Select files to upload"
              disabled={isUploading}
            />

            {/* ✅ PREMIUM: Grid Layout - Icon-first design */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {/* Choose Photo - PRIMARY ACTION (highlighted) */}
              <motion.button
                disabled={isUploading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (!isUploading) {
                    imageInputRef.current?.click();
                  }
                }}
                className={`flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-5 rounded-2xl transition-all duration-200 border-2 group ${
                  isUploading 
                    ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                    : 'bg-gradient-to-br from-atlas-sage/30 to-atlas-peach/20 border-atlas-sage/50 hover:border-atlas-sage shadow-lg hover:shadow-xl'
                }`}
                aria-label="Choose photos or videos from gallery"
                aria-disabled={isUploading}
              >
                <motion.div
                  animate={!isUploading ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className={`p-2 sm:p-2.5 rounded-xl transition-colors shadow-sm ${
                    isUploading 
                      ? 'bg-atlas-sage/20' 
                      : 'bg-atlas-sage/40 group-hover:bg-atlas-sage/60'
                  }`}
                >
                  <ImageIcon className="w-6 h-6 sm:w-7 sm:h-7 text-atlas-stone" />
                </motion.div>
                <span className="text-xs sm:text-sm font-semibold text-gray-900">Photo</span>
                <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:block">Gallery</span>
              </motion.button>

              {/* Take Photo */}
              <motion.button
                disabled={isUploading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCameraClick}
                className={`flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-5 rounded-2xl transition-all duration-200 border-2 group ${
                  isUploading 
                    ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                    : 'bg-white/80 hover:bg-atlas-peach/30 border-atlas-sand hover:border-atlas-sage shadow-md hover:shadow-lg'
                }`}
                aria-label="Take photo with camera"
                aria-disabled={isUploading}
              >
                <div className={`p-2 sm:p-2.5 rounded-xl transition-colors shadow-sm ${
                  isUploading 
                    ? 'bg-atlas-sage/20' 
                    : 'bg-atlas-peach/30 group-hover:bg-atlas-peach/50'
                }`}>
                  <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-atlas-stone" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-900">Camera</span>
                <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:block">Capture</span>
              </motion.button>

              {/* Attach File */}
              <motion.button
                disabled={isUploading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (!isUploading) {
                    fileInputRef.current?.click();
                  }
                }}
                className={`flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-5 rounded-2xl transition-all duration-200 border-2 group ${
                  isUploading 
                    ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                    : 'bg-white/80 hover:bg-atlas-peach/30 border-atlas-sand hover:border-atlas-sage shadow-md hover:shadow-lg'
                }`}
                aria-label="Attach files, documents, or PDFs"
                aria-disabled={isUploading}
              >
                <div className={`p-2 sm:p-2.5 rounded-xl transition-colors shadow-sm ${
                  isUploading 
                    ? 'bg-atlas-sage/20' 
                    : 'bg-atlas-peach/30 group-hover:bg-atlas-peach/50'
                }`}>
                  <FileUp className="w-6 h-6 sm:w-7 sm:h-7 text-atlas-stone" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-900">File</span>
                <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:block">Upload</span>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AttachmentMenu;
