import { AnimatePresence, motion } from 'framer-motion';
import { Camera, FileUp, Image as ImageIcon, Lock } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useFileUpload } from '@/hooks/useFileUpload';
import { useFeatureAccess, useTierAccess } from '@/hooks/useTierAccess';
import { useUpgradeModals } from '../../contexts/UpgradeModalContext';
import { logger } from '../../lib/logger';

// ✅ DEBUG: Conditional logging (dev only)
const isDev = import.meta.env.DEV;
const debugLog = (...args: any[]) => isDev && console.log(...args);

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onAddAttachment?: (attachment: { id: string; type: string; url?: string; publicUrl?: string; file?: File; previewUrl?: string; name?: string }) => void;
  imageInputRef?: React.RefObject<HTMLInputElement>;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  cameraInputRef?: React.RefObject<HTMLInputElement>;
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
  imageInputRef: externalImageInputRef,
  fileInputRef: externalFileInputRef,
  cameraInputRef: externalCameraInputRef,
}) => {
  const internalImageInputRef = useRef<HTMLInputElement>(null);
  const internalCameraInputRef = useRef<HTMLInputElement>(null);
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  
  // ✅ CRITICAL FIX: Always use internal refs for AttachmentMenu inputs
  // External refs are for EnhancedInputToolbar's own inputs (separate flow)
  // This prevents conflicts and ensures menu buttons work correctly
  const imageInputRef = internalImageInputRef;
  const cameraInputRef = internalCameraInputRef;
  const fileInputRef = internalFileInputRef;
  
  // Tier access checks
  const { tier } = useTierAccess();
  const { canUse: canUseImage, attemptFeature: attemptImage } = useFeatureAccess('image');
  const { canUse: canUseCamera, attemptFeature: attemptCamera } = useFeatureAccess('camera');
  const { canUse: canUseFile, attemptFeature: attemptFile } = useFeatureAccess('file');
  const { showGenericUpgrade } = useUpgradeModals();
  
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
    
    debugLog(`[AttachmentMenu] handleFileSelect called for ${source}`, { hasFile: !!file, fileName: file?.name });
    
    // ✅ Handle cancel case - user cancelled native picker
    if (!file) {
      e.target.value = '';
      debugLog('[AttachmentMenu] User cancelled picker - menu stays open');
      // Menu stays open (correct behavior)
      return;
    }

    // ✅ CRITICAL: Secondary tier check BEFORE processing file (bypass prevention safety net)
    // This is a safety net in case file picker was triggered directly or bypassed initial checks
    let hasAccess = false;
    if (source === 'gallery') {
      hasAccess = await attemptImage();
    } else if (source === 'file') {
      hasAccess = await attemptFile();
    } else if (source === 'camera') {
      hasAccess = await attemptCamera();
    }
    
    if (!hasAccess) {
      debugLog(`[AttachmentMenu] No access for ${source} - showing upgrade modal (secondary check)`);
      // Clear input to prevent re-selection
      e.target.value = '';
      // ✅ Trigger beautiful upgrade modal with animating icons
      // Map source to modal feature: camera=Studio, file/image=Core
      if (source === 'gallery') {
        showGenericUpgrade('image');
      } else if (source === 'file') {
        showGenericUpgrade('file');
      } else if (source === 'camera') {
        showGenericUpgrade('camera');
      }
      // Menu stays open if no access (user can try again)
      return;
    }

    // Clear input for next selection (only after tier check passes)
    e.target.value = '';

    try {
      debugLog(`[AttachmentMenu] Starting upload for ${source}:`, file.name);
      await uploadFile(file, source);
      debugLog(`[AttachmentMenu] Upload successful for ${source}`);
      // ✅ Menu closes automatically in useFileUpload onSuccess callback (line 64)
    } catch (error) {
      // Error handling is done in useFileUpload hook
      logger.error('[AttachmentMenu] Upload failed:', error);
      debugLog('[AttachmentMenu] Upload failed - menu stays open for retry');
      // Menu stays open on error (user can retry)
    }
  };

  // ✅ BEST PRACTICE: Trigger picker, keep menu open until file is selected
  const handleFileClick = async () => {
    if (isUploading) return;
    
    const hasAccess = await attemptFile();
    if (!hasAccess) {
      // ✅ Trigger beautiful upgrade modal with animating icons
      showGenericUpgrade('file');
      return;
    }
    
    // Trigger picker - menu stays open until file is selected
    const input = fileInputRef.current;
    if (input) {
      debugLog('[AttachmentMenu] Triggering file picker');
      input.click();
      // Menu stays open - will close in handleFileSelect after successful selection
    } else {
      logger.error('[AttachmentMenu] File input ref not available');
      debugLog('[AttachmentMenu] File input ref is null');
    }
  };

  const handleCameraClick = async () => {
    if (isUploading) return;
    
    // Check tier access for camera
    const hasAccess = await attemptCamera();
    if (!hasAccess) {
      // ✅ Trigger beautiful upgrade modal with animating icons
      showGenericUpgrade('camera');
      return;
    }
    
    // Trigger picker - menu stays open until file is selected
    const input = cameraInputRef.current;
    if (input) {
      debugLog('[AttachmentMenu] Triggering camera picker');
      input.click();
      // Menu stays open - will close in handleFileSelect after successful selection
    } else {
      logger.error('[AttachmentMenu] Camera input ref not available');
      debugLog('[AttachmentMenu] Camera input ref is null');
    }
  };

  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // ✅ Constants for menu dimensions (production-standard)
  const MENU_W_MOBILE = 280;
  const MENU_H_MOBILE = 180;
  const MENU_W_DESKTOP = 340;
  const MENU_H_DESKTOP = 200;
  const SPACING = 12; // ✅ Keep 12 for mobile compatibility
  const PADDING = 8;

  // ✅ CRITICAL FIX: Calculate position WITHOUT relying on ref (ref is null before portal renders)
  useLayoutEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = 'unset';
      setPosition(null);
      
      // ✅ Restore vercel-live-feedback when menu closes (but keep it hidden)
      const vercelFeedback = document.querySelector('vercel-live-feedback') as HTMLElement | null;
      if (vercelFeedback) {
        // Keep it hidden - we don't want it interfering at all
        vercelFeedback.style.display = 'none';
      }
      
      return;
    }

    document.body.style.overflow = 'hidden';
    
    // ✅ CRITICAL: Completely hide vercel-live-feedback when menu is open
    // This element has z-index: 2147483647 and blocks all interactions
    const vercelFeedback = document.querySelector('vercel-live-feedback') as HTMLElement | null;
    if (vercelFeedback) {
      vercelFeedback.style.display = 'none';
      vercelFeedback.style.visibility = 'hidden';
      vercelFeedback.style.pointerEvents = 'none';
    }

    const calculatePosition = () => {
      try {
        const button = document.querySelector('[data-attachment-button]') as HTMLElement | null;
        const inputArea = document.querySelector('[data-input-area]') as HTMLElement | null;
        const isMobile = window.matchMedia('(max-width: 639px)').matches;

        // ✅ Use constants, NOT ref measurements (ref is null before portal renders)
        const menuW = isMobile ? MENU_W_MOBILE : MENU_W_DESKTOP;
        const menuH = isMobile ? MENU_H_MOBILE : MENU_H_DESKTOP;

        let top = 0;
        let left = 0;

        if (button && inputArea) {
          const buttonRect = button.getBoundingClientRect();
          const inputRect = inputArea.getBoundingClientRect();
          
          // ✅ Center horizontally relative to button
          left = buttonRect.left + buttonRect.width / 2 - menuW / 2;

          // ✅ Desktop: Position above input with 16px spacing
          if (window.innerWidth >= 768) {
            top = inputRect.top - menuH - 16;
            // ✅ If would go off top, position below button
            if (top < PADDING) {
              top = buttonRect.bottom + SPACING;
            }
          } else {
            // ✅ Mobile: Position above input
            top = inputRect.top - menuH - SPACING;
            // ✅ If no room above, position below button
            if (top < PADDING) {
              top = buttonRect.bottom + SPACING;
            }
          }
        } else if (button) {
          // ✅ Fallback: Position relative to button only
          const buttonRect = button.getBoundingClientRect();
          left = buttonRect.left + buttonRect.width / 2 - menuW / 2;
          top = buttonRect.top - menuH - SPACING;
          if (top < PADDING) {
            top = buttonRect.bottom + SPACING;
          }
        } else {
          // ✅ Last resort: Center of viewport
          left = (window.innerWidth - menuW) / 2;
          top = Math.max(PADDING, window.innerHeight * 0.6 - menuH / 2);
        }

        // ✅ Clamp to viewport (final safety check)
        left = Math.max(PADDING, Math.min(left, window.innerWidth - menuW - PADDING));
        top = Math.max(PADDING, Math.min(top, window.innerHeight - menuH - PADDING));

        setPosition({ top, left });
      } catch (error) {
        // ✅ Fallback: upper-middle
        logger.error('[AttachmentMenu] Position calculation failed, using default:', error);
        const isMobile = window.matchMedia('(max-width: 639px)').matches;
        const menuW = isMobile ? MENU_W_MOBILE : MENU_W_DESKTOP;
        setPosition({
          top: Math.max(PADDING, window.innerHeight * 0.15),
          left: (window.innerWidth - menuW) / 2,
        });
      }
    };

    // ✅ Calculate immediately (doesn't need ref)
    calculatePosition();

    // ✅ Recalculate on resize/scroll
    const onWinChange = () => calculatePosition();
    window.addEventListener('resize', onWinChange);
    window.addEventListener('scroll', onWinChange, { passive: true });

    return () => {
      window.removeEventListener('resize', onWinChange);
      window.removeEventListener('scroll', onWinChange);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // ✅ PROFESSIONAL: Close on escape key (consistent with MessageContextMenu)
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // ✅ Robust outside-click (bind immediately, defer check to ignore opening click)
  useEffect(() => {
    if (!isOpen) return;

    let clickTimeout: NodeJS.Timeout;

    const handler = (evt: MouseEvent | TouchEvent) => {
      // ✅ Small delay to ignore the opening click
      clearTimeout(clickTimeout);
      clickTimeout = setTimeout(() => {
        const target = evt.target as Node;
        const menu = menuRef.current;
        const trigger = document.querySelector('[data-attachment-button]');
        if (!menu || menu.contains(target) || trigger?.contains(target)) return;
        onClose();
      }, 100);
    };

    // ✅ Bind immediately (don't delay with requestAnimationFrame)
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });

    return () => {
      clearTimeout(clickTimeout);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen, onClose]);

  // ✅ WEB FIX: Force visibility after mount to ensure menu appears
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    
    // Force visibility styles directly on the DOM element
    const menu = menuRef.current;
    menu.style.setProperty('opacity', '1', 'important');
    menu.style.setProperty('visibility', 'visible', 'important');
    menu.style.setProperty('display', 'block', 'important');
    // ✅ Don't override z-index here - let inline style handle it (10003)
    
    // Also check if element is actually in DOM
    if (!document.body.contains(menu)) {
      logger.error('[AttachmentMenu] Menu element not in document.body!');
    }
  }, [isOpen]);
  

  // ✅ CRITICAL: Use fallback position if calculation hasn't completed yet
  const displayPosition = position || (() => {
    // ✅ FALLBACK: Always provide a valid position
    if (typeof window === 'undefined') {
      return { top: 100, left: 100 };
    }
    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    const menuWidth = isMobile ? 280 : 340;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Try to find input area for better positioning
    const inputArea = document.querySelector('[data-input-area]') as HTMLElement;
    let top = Math.max(8, viewportHeight * 0.15);
    
    if (inputArea) {
      const rect = inputArea.getBoundingClientRect();
      const menuHeight = isMobile ? 180 : 200;
      top = Math.max(8, rect.top - menuHeight - 12);
    }
    
    return {
      top,
      left: (viewportWidth - menuWidth) / 2
    };
  })();

  // ✅ DEBUG: Log position for troubleshooting (only in dev mode, minimal logging)
  useEffect(() => {
    if (isOpen && isDev) {
      debugLog('[AttachmentMenu] Menu opened');
      if (menuRef.current) {
        setTimeout(() => {
          const rect = menuRef.current?.getBoundingClientRect();
          debugLog('[AttachmentMenu] Position:', { top: rect?.top, left: rect?.left });
        }, 100);
      }
    }
  }, [isOpen]);

  // ✅ Animation variants for menu entrance/exit
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        duration: 0.2,
      }
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.15,
        ease: 'easeOut'
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    show: { 
      opacity: 1, 
      scale: 1,
      transition: {
        type: 'spring',
        damping: 20,
        stiffness: 300
      }
    }
  };

  const menuVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    show: { 
      opacity: 1, 
      scale: 1,
      transition: {
        type: 'spring',
        damping: 20,
        stiffness: 300,
        duration: 0.2
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.15,
        ease: 'easeOut'
      }
    }
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ✅ CRITICAL ONE-SHOT FIX: Force maximum z-index with !important to override ANY overlay */}
          <style dangerouslySetInnerHTML={{ __html: `
            [data-attachment-menu] {
              z-index: 2147483647 !important;
              pointer-events: auto !important;
              position: fixed !important;
            }
            vercel-live-feedback {
              z-index: -1 !important;
              pointer-events: none !important;
            }
          `}} />
          
          {/* ✅ MENU (renders first, higher z-index) with animations */}
          <motion.div
            ref={menuRef}
            data-attachment-menu
            variants={menuVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed w-[280px] sm:w-[340px] max-w-[calc(100vw-16px)] rounded-3xl bg-gradient-to-br from-atlas-pearl to-atlas-peach shadow-2xl border-2 border-atlas-sand p-6 sm:p-8"
            style={{
              top: `${displayPosition.top}px`,
              left: `${displayPosition.left}px`,
              boxShadow: '0 20px 60px rgba(151, 134, 113, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
              position: 'fixed',
              zIndex: 2147483647, // ✅ ABSOLUTE MAXIMUM z-index
              transform: 'translateZ(0)',
              pointerEvents: 'auto',
              touchAction: 'manipulation',
              isolation: 'isolate', // ✅ Create new stacking context
            }}
            onClick={(e) => e.stopPropagation()}
          >
        {/* Hidden inputs */}
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

        {/* Grid Layout with stagger animations */}
        <motion.div 
          className="grid grid-cols-3 gap-3 sm:gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Choose Photo */}
          <motion.button
            variants={itemVariants}
            disabled={isUploading || !canUseImage}
            whileHover={canUseImage && !isUploading ? { scale: 1.05 } : {}}
            whileTap={canUseImage && !isUploading ? { scale: 0.95 } : {}}
            onClick={async () => {
              if (isUploading) return;
              
              // Check tier access before opening picker
              const hasAccess = await attemptImage();
              if (!hasAccess) {
                // ✅ Trigger beautiful upgrade modal with animating icons
                showGenericUpgrade('image');
                return;
              }
              
              // ✅ BEST PRACTICE: Trigger picker, keep menu open until file is selected
              const input = imageInputRef.current;
              if (input) {
                debugLog('[AttachmentMenu] Triggering image picker');
                input.click();
                // Menu stays open - will close in handleFileSelect after successful selection
              } else {
                logger.error('[AttachmentMenu] Image input ref not available');
                debugLog('[AttachmentMenu] Image input ref is null');
              }
            }}
            className={`relative flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-5 rounded-2xl transition-all duration-200 border-2 group ${
              isUploading || !canUseImage
                ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                : 'bg-gradient-to-br from-atlas-sage/30 to-atlas-peach/20 border-atlas-sage/50 hover:border-atlas-sage shadow-lg hover:shadow-xl'
            }`}
            aria-label={canUseImage ? "Choose photos or videos from gallery" : "Upgrade to Core or Studio to upload images"}
            aria-disabled={isUploading || !canUseImage}
            title={!canUseImage ? "Upgrade to Core or Studio to upload images" : undefined}
          >
            <motion.div
              animate={!isUploading && canUseImage ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={canUseImage && !isUploading ? { scale: 1.1 } : {}}
              className={`p-2 sm:p-2.5 rounded-xl transition-all duration-200 shadow-sm ${
                isUploading || !canUseImage
                  ? 'bg-atlas-sage/20' 
                  : 'bg-atlas-sage/40 group-hover:bg-atlas-sage/60 group-hover:shadow-md'
              }`}
            >
              <ImageIcon className="w-6 h-6 sm:w-7 sm:h-7 text-atlas-stone" />
              {!canUseImage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Lock className="absolute top-1 right-1 w-3 h-3 text-gray-500" />
                </motion.div>
              )}
            </motion.div>
            <span className="text-xs sm:text-sm font-semibold text-gray-900">Photo</span>
            <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:block">
              {!canUseImage ? 'Upgrade' : 'Gallery'}
            </span>
          </motion.button>

          {/* Take Photo */}
          <motion.button
            variants={itemVariants}
            disabled={isUploading || !canUseCamera}
            whileHover={canUseCamera && !isUploading ? { scale: 1.05 } : {}}
            whileTap={canUseCamera && !isUploading ? { scale: 0.95 } : {}}
            onClick={handleCameraClick}
            className={`relative flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-5 rounded-2xl transition-all duration-200 border-2 group ${
              isUploading || !canUseCamera
                ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                : 'bg-white/80 hover:bg-atlas-peach/30 border-atlas-sand hover:border-atlas-sage shadow-md hover:shadow-lg'
            }`}
            aria-label={canUseCamera ? "Take photo with camera" : "Upgrade to Studio to use camera"}
            aria-disabled={isUploading || !canUseCamera}
            title={!canUseCamera ? "Upgrade to Studio to use camera" : undefined}
          >
            <motion.div 
              whileHover={canUseCamera && !isUploading ? { scale: 1.05 } : {}}
              className={`relative p-2 sm:p-2.5 rounded-xl transition-all duration-200 shadow-sm ${
                isUploading || !canUseCamera
                  ? 'bg-atlas-sage/20' 
                  : 'bg-atlas-peach/30 group-hover:bg-atlas-peach/50 group-hover:shadow-md'
              }`}
            >
              <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-atlas-stone" />
              {!canUseCamera && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Lock className="absolute top-1 right-1 w-3 h-3 text-gray-500" />
                </motion.div>
              )}
            </motion.div>
            <span className="text-xs sm:text-sm font-semibold text-gray-900">Camera</span>
            <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:block">
              {!canUseCamera ? 'Studio' : 'Capture'}
            </span>
          </motion.button>

          {/* Attach File */}
          <motion.button
            variants={itemVariants}
            disabled={isUploading || !canUseFile}
            whileHover={canUseFile && !isUploading ? { scale: 1.05 } : {}}
            whileTap={canUseFile && !isUploading ? { scale: 0.95 } : {}}
            onClick={handleFileClick}
            className={`relative flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-5 rounded-2xl transition-all duration-200 border-2 group ${
              isUploading || !canUseFile
                ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                : 'bg-white/80 hover:bg-atlas-peach/30 border-atlas-sand hover:border-atlas-sage shadow-md hover:shadow-lg'
            }`}
            aria-label={canUseFile ? "Attach files, documents, or PDFs" : "Upgrade to Core or Studio to upload files"}
            aria-disabled={isUploading || !canUseFile}
            title={!canUseFile ? "Upgrade to Core or Studio to upload files" : undefined}
          >
            <motion.div 
              whileHover={canUseFile && !isUploading ? { scale: 1.05 } : {}}
              className={`relative p-2 sm:p-2.5 rounded-xl transition-all duration-200 shadow-sm ${
                isUploading || !canUseFile
                  ? 'bg-atlas-sage/20' 
                  : 'bg-atlas-peach/30 group-hover:bg-atlas-peach/50 group-hover:shadow-md'
              }`}
            >
              <FileUp className="w-6 h-6 sm:w-7 sm:h-7 text-atlas-stone" />
              {!canUseFile && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Lock className="absolute top-1 right-1 w-3 h-3 text-gray-500" />
                </motion.div>
              )}
            </motion.div>
            <span className="text-xs sm:text-sm font-semibold text-gray-900">File</span>
            <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:block">
              {!canUseFile ? 'Upgrade' : 'Upload'}
            </span>
          </motion.button>
        </motion.div>
      </motion.div>

          {/* ✅ BACKDROP (renders after menu, lower z-index, for outside-click) with animation */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-0 bg-transparent"
            aria-hidden="true"
            style={{
              pointerEvents: 'auto',
              transform: 'translateZ(0)',
              zIndex: 2147483645, // ✅ High z-index but below menu
              isolation: 'isolate', // ✅ Create new stacking context
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default AttachmentMenu;
