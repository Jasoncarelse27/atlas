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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close Button */}
          <motion.button
            className="absolute top-4 right-4 z-10 p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-6 h-6 text-white" />
          </motion.button>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <motion.button
                className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all duration-200 ${
                  currentIndex > 0 
                    ? 'bg-white/20 hover:bg-white/30 cursor-pointer' 
                    : 'bg-white/10 cursor-not-allowed opacity-50'
                }`}
                onClick={currentIndex > 0 ? handlePrev : undefined}
                whileHover={currentIndex > 0 ? { scale: 1.1 } : {}}
                whileTap={currentIndex > 0 ? { scale: 0.95 } : {}}
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </motion.button>
              
              <motion.button
                className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all duration-200 ${
                  currentIndex < images.length - 1 
                    ? 'bg-white/20 hover:bg-white/30 cursor-pointer' 
                    : 'bg-white/10 cursor-not-allowed opacity-50'
                }`}
                onClick={currentIndex < images.length - 1 ? handleNext : undefined}
                whileHover={currentIndex < images.length - 1 ? { scale: 1.1 } : {}}
                whileTap={currentIndex < images.length - 1 ? { scale: 0.95 } : {}}
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </motion.button>
            </>
          )}

          {/* Image with Smooth Transitions */}
          <motion.div
            key={currentIndex}
            className="relative w-full h-full flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <motion.img
              src={currentImage.url}
              alt={currentImage.name || 'Image'}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto'
              }}
            />
          </motion.div>

          {/* Image Counter */}
          {images.length > 1 && (
            <motion.div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 px-4 py-2 rounded-full text-white text-sm font-medium"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {currentIndex + 1} / {images.length}
            </motion.div>
          )}

          {/* Image Name */}
          {currentImage.name && (
            <motion.div
              className="absolute top-4 left-4 bg-white/20 px-3 py-1 rounded-full text-white text-sm"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {currentImage.name}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
