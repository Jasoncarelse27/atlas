import { motion } from 'framer-motion';
import { Camera, FileUp, Image as ImageIcon, Lock } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useFileUpload } from '@/hooks/useFileUpload';
import { useFeatureAccess, useTierAccess } from '@/hooks/useTierAccess';
import { useUpgradeModals } from '../../contexts/UpgradeModalContext';
import { logger } from '../../lib/logger';

// ✅ CRITICAL: Module-level log to verify code is loaded
console.log('[AttachmentMenu] 📦 MODULE LOADED - Code is in bundle');

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
  
  // Use external refs if provided, otherwise use internal refs
  const imageInputRef = externalImageInputRef || internalImageInputRef;
  const cameraInputRef = externalCameraInputRef || internalCameraInputRef;
  const fileInputRef = externalFileInputRef || internalFileInputRef;
  
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
    if (!file) return;

    // Clear input for next selection
    e.target.value = '';
    
    // ✅ Safety: Close menu before native picker opens (prevents double menu)
    onClose();
    
    // Check tier access based on source
    let hasAccess = false;
    if (source === 'gallery') {
      hasAccess = await attemptImage();
    } else if (source === 'file') {
      hasAccess = await attemptFile();
    } else if (source === 'camera') {
      hasAccess = await attemptCamera();
    }
    
    if (!hasAccess) {
      return; // attemptFeature already shows upgrade modal
    }

    try {
      await uploadFile(file, source);
    } catch (error) {
      // Error handling is done in useFileUpload hook
      logger.error('[AttachmentMenu] Upload failed:', error);
    }
  };

  // Handle file button click with tier check
  const handleFileClick = async () => {
    const hasAccess = await attemptFile();
    if (!hasAccess) {
      return; // attemptFile already shows upgrade modal
    }
    onClose();
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  const handleCameraClick = async () => {
    // Check tier access for camera
    const hasAccess = await attemptCamera();
    if (!hasAccess) {
      return; // attemptCamera already shows upgrade modal
    }
    onClose(); // ✅ Close menu immediately to prevent double representation
    setTimeout(() => {
      cameraInputRef.current?.click();
    }, 100); // Small delay to ensure menu closes first
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

  // ✅ DEBUG: Log position for troubleshooting (only in dev mode)
  useEffect(() => {
    if (isOpen && import.meta.env.DEV) {
      console.log('[AttachmentMenu] ✅ Menu opened');
      console.log('[AttachmentMenu] Position state:', position);
      console.log('[AttachmentMenu] Display position:', displayPosition);
      setTimeout(() => {
        if (menuRef.current) {
          const rect = menuRef.current.getBoundingClientRect();
          const styles = window.getComputedStyle(menuRef.current);
          console.log('[AttachmentMenu] DOM check:', {
            inDOM: document.body.contains(menuRef.current),
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            styles: { opacity: styles.opacity, visibility: styles.visibility, zIndex: styles.zIndex },
            visible: rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
          });
        } else {
          console.warn('[AttachmentMenu] ⚠️ menuRef.current is null');
        }
      }, 100);
    }
  }, [isOpen, position, displayPosition]);

  // ✅ DEBUG: Log render state (always log, not just in DEV)
  if (isOpen) {
    console.log('[AttachmentMenu] ✅ Rendering - isOpen:', isOpen, 'position:', position, 'displayPosition:', displayPosition);
  }

  // ✅ CRITICAL FIX: Render menu first, then backdrop (correct stacking order)
  if (!isOpen) {
    return null;
  }
  return createPortal(
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
      
      {/* ✅ MENU (renders first, higher z-index) */}
      <div
        ref={menuRef}
        data-attachment-menu
        className="fixed w-[280px] sm:w-[340px] max-w-[calc(100vw-16px)] rounded-3xl bg-gradient-to-br from-atlas-pearl to-atlas-peach shadow-2xl border-2 border-atlas-sand p-6 sm:p-8"
        style={{
          top: `${displayPosition.top}px`,
          left: `${displayPosition.left}px`,
          boxShadow: '0 20px 60px rgba(151, 134, 113, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
          opacity: 1,
          visibility: 'visible',
          display: 'block',
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

        {/* Grid Layout */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {/* Choose Photo */}
          <motion.button
            disabled={isUploading || !canUseImage}
            whileHover={canUseImage && !isUploading ? { scale: 1.05 } : {}}
            whileTap={canUseImage && !isUploading ? { scale: 0.95 } : {}}
            onClick={async () => {
              if (isUploading) return;
              
              // Check tier access before opening picker
              const hasAccess = await attemptImage();
              if (!hasAccess) {
                return; // attemptImage already shows upgrade modal
              }
              
              onClose(); // ✅ Close menu immediately to prevent double representation
              setTimeout(() => {
                imageInputRef.current?.click();
              }, 100); // Small delay to ensure menu closes first
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
              className={`p-2 sm:p-2.5 rounded-xl transition-colors shadow-sm ${
                isUploading || !canUseImage
                  ? 'bg-atlas-sage/20' 
                  : 'bg-atlas-sage/40 group-hover:bg-atlas-sage/60'
              }`}
            >
              <ImageIcon className="w-6 h-6 sm:w-7 sm:h-7 text-atlas-stone" />
              {!canUseImage && (
                <Lock className="absolute top-1 right-1 w-3 h-3 text-gray-500" />
              )}
            </motion.div>
            <span className="text-xs sm:text-sm font-semibold text-gray-900">Photo</span>
            <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:block">
              {!canUseImage ? 'Upgrade' : 'Gallery'}
            </span>
          </motion.button>

          {/* Take Photo */}
          <motion.button
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
            <div className={`relative p-2 sm:p-2.5 rounded-xl transition-colors shadow-sm ${
              isUploading || !canUseCamera
                ? 'bg-atlas-sage/20' 
                : 'bg-atlas-peach/30 group-hover:bg-atlas-peach/50'
            }`}>
              <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-atlas-stone" />
              {!canUseCamera && (
                <Lock className="absolute top-1 right-1 w-3 h-3 text-gray-500" />
              )}
            </div>
            <span className="text-xs sm:text-sm font-semibold text-gray-900">Camera</span>
            <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:block">
              {!canUseCamera ? 'Studio' : 'Capture'}
            </span>
          </motion.button>

          {/* Attach File */}
          <motion.button
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
            <div className={`relative p-2 sm:p-2.5 rounded-xl transition-colors shadow-sm ${
              isUploading || !canUseFile
                ? 'bg-atlas-sage/20' 
                : 'bg-atlas-peach/30 group-hover:bg-atlas-peach/50'
            }`}>
              <FileUp className="w-6 h-6 sm:w-7 sm:h-7 text-atlas-stone" />
              {!canUseFile && (
                <Lock className="absolute top-1 right-1 w-3 h-3 text-gray-500" />
              )}
            </div>
            <span className="text-xs sm:text-sm font-semibold text-gray-900">File</span>
            <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:block">
              {!canUseFile ? 'Upgrade' : 'Upload'}
            </span>
          </motion.button>
        </div>
      </div>

          {/* ✅ BACKDROP (renders after menu, lower z-index, for outside-click) */}
          <div
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
    </>,
    document.body
  );
};

export default AttachmentMenu;
