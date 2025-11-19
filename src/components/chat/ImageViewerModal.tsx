import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import React, { useEffect } from 'react';

interface Attachment {
  id?: string;
  url: string;
  name?: string;
  type?: string;
}

interface ImageViewerModalProps {
  visible: boolean;
  onClose: () => void;
  images: Attachment[];
  startIndex?: number;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  onClose,
  images,
  startIndex = 0
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(startIndex);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(startIndex);
    }
  }, [visible, startIndex]);

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
  };

  if (!visible || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 safe-area"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)'
          }}
        >
          {/* Close Button - Mobile Responsive */}
          <motion.button
            className="absolute top-4 right-4 z-[10000] p-3 sm:p-4 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full transition-colors touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{
              minWidth: '44px',
              minHeight: '44px',
              top: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 1rem))',
              right: 'max(1rem, calc(env(safe-area-inset-right, 0px) + 1rem))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Close image viewer"
          >
            <X className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </motion.button>

          {/* Navigation Arrows - Mobile Responsive */}
          {images.length > 1 && (
            <>
              <motion.button
                className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full transition-all duration-200 touch-manipulation ${
                  currentIndex > 0 
                    ? 'bg-white/20 hover:bg-white/30 active:bg-white/40 cursor-pointer' 
                    : 'bg-white/10 cursor-not-allowed opacity-50'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentIndex > 0) handlePrev();
                }}
                whileHover={currentIndex > 0 ? { scale: 1.1 } : {}}
                whileTap={currentIndex > 0 ? { scale: 0.95 } : {}}
                style={{
                  minWidth: '44px',
                  minHeight: '44px',
                  left: 'max(1rem, calc(env(safe-area-inset-left, 0px) + 1rem))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Previous image"
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </motion.button>
              
              <motion.button
                className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full transition-all duration-200 touch-manipulation ${
                  currentIndex < images.length - 1 
                    ? 'bg-white/20 hover:bg-white/30 active:bg-white/40 cursor-pointer' 
                    : 'bg-white/10 cursor-not-allowed opacity-50'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentIndex < images.length - 1) handleNext();
                }}
                whileHover={currentIndex < images.length - 1 ? { scale: 1.1 } : {}}
                whileTap={currentIndex < images.length - 1 ? { scale: 0.95 } : {}}
                style={{
                  minWidth: '44px',
                  minHeight: '44px',
                  right: 'max(1rem, calc(env(safe-area-inset-right, 0px) + 1rem))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Next image"
                disabled={currentIndex === images.length - 1}
              >
                <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </motion.button>
            </>
          )}

          {/* Image with Smooth Transitions - Mobile Optimized */}
          <motion.div
            key={currentIndex}
            className="relative w-full h-full flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              paddingTop: 'max(4rem, calc(env(safe-area-inset-top, 0px) + 4rem))',
              paddingBottom: 'max(4rem, calc(env(safe-area-inset-bottom, 0px) + 4rem))',
              paddingLeft: 'max(1rem, calc(env(safe-area-inset-left, 0px) + 1rem))',
              paddingRight: 'max(1rem, calc(env(safe-area-inset-right, 0px) + 1rem))'
            }}
          >
            <motion.img
              src={currentImage.url}
              alt={currentImage.name || 'Image'}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl touch-manipulation"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                userSelect: 'none',
                WebkitUserSelect: 'none'
              }}
              draggable={false}
            />
          </motion.div>

          {/* Image Counter - Mobile Responsive */}
          {images.length > 1 && (
            <motion.div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm sm:text-base font-medium"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                bottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))'
              }}
            >
              {currentIndex + 1} / {images.length}
            </motion.div>
          )}

          {/* Image Name - Mobile Responsive */}
          {currentImage.name && (
            <motion.div
              className="absolute top-4 left-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs sm:text-sm max-w-[60%] truncate"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{
                top: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 1rem))',
                left: 'max(1rem, calc(env(safe-area-inset-left, 0px) + 1rem))'
              }}
              title={currentImage.name}
            >
              {currentImage.name}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
