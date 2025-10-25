import { motion } from 'framer-motion';
import { FileText, Music, Play } from 'lucide-react';
import React, { useState } from 'react';
import { ImageViewerModal } from './ImageViewerModal';

interface Attachment {
  id?: string;
  url: string;
  name?: string;
  type?: string;
  previewUrl?: string;
}

interface ImageGalleryProps {
  attachments: Attachment[];
  isUser?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  attachments, 
  isUser = false,
  onContextMenu,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}) => {
  const [viewerVisible, setViewerVisible] = useState<boolean>(false);
  const [viewerIndex, setViewerIndex] = useState<number>(0);
  const [isLongPressing, setIsLongPressing] = useState<boolean>(false);

  const getFileType = (url: string): string => {
    if (!url) return 'unknown';
    const ext = url.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return 'audio';
    if (['pdf'].includes(ext)) return 'pdf';
    return 'file';
  };

  const imageAttachments = attachments.filter(att => getFileType(att.url) === 'image');
  const otherAttachments = attachments.filter(att => getFileType(att.url) !== 'image');

  const handleImageClick = (index: number, e?: React.MouseEvent) => {
    // Don't open viewer if user is long-pressing for context menu
    if (isLongPressing) return;
    
    // Only handle left-click (button 0), ignore right-click (button 2)
    if (e && e.button !== 0) return;
    
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const handleCloseViewer = () => {
    setViewerVisible(false);
  };

  const handleFileClick = (url: string) => {
    window.open(url, '_blank');
  };

  // ✅ Wrap touch handlers to track long-press state
  const handleTouchStartWrapper = (e: React.TouchEvent) => {
    setIsLongPressing(false);
    if (onTouchStart) {
      onTouchStart(e);
      // Set flag after 400ms (before the 500ms menu trigger)
      setTimeout(() => setIsLongPressing(true), 400);
    }
  };

  const handleTouchEndWrapper = (e: React.TouchEvent) => {
    // Reset after a delay to allow click handler to see the flag
    setTimeout(() => setIsLongPressing(false), 100);
    if (onTouchEnd) {
      onTouchEnd(e);
    }
  };

  if (attachments.length === 0) return null;

  return (
    <>
      {/* 🖼️ Mobile-Optimized Image Gallery */}
      {imageAttachments.length > 0 && (
        <div className="mt-3">
          <div className={`grid gap-2 ${
            imageAttachments.length === 1 
              ? 'grid-cols-1' 
              : imageAttachments.length === 2 
                ? 'grid-cols-2' 
                : imageAttachments.length === 3 
                  ? 'grid-cols-2' 
                  : 'grid-cols-2 sm:grid-cols-3'
          }`}>
            {imageAttachments.map((att, idx) => {
              // Smart sizing based on count and position - MOBILE OPTIMIZED
              const getImageClass = () => {
                if (imageAttachments.length === 1) {
                  return 'h-48 sm:h-64 w-full'; // Responsive height for single image
                }
                if (imageAttachments.length === 2) {
                  return 'h-40 sm:h-48 w-full'; // Responsive height for pairs
                }
                if (imageAttachments.length === 3 && idx === 0) {
                  return 'h-40 sm:h-48 w-full col-span-2'; // First image spans 2 columns, responsive
                }
                return 'h-32 sm:h-40 w-full'; // Default smaller responsive height
              };

              return (
                <motion.div
                  key={idx}
                  className="relative group cursor-pointer overflow-hidden"
                  onMouseDown={(e) => {
                    // Only handle left-click for gallery, allow right-click to pass through
                    if (e.button === 0) {
                      handleImageClick(idx, e);
                    }
                  }}
                  onContextMenu={onContextMenu}
                  onTouchStart={handleTouchStartWrapper}
                  onTouchMove={onTouchMove}
                  onTouchEnd={handleTouchEndWrapper}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={`${getImageClass()} w-full`}>
                    <img
                      src={att.previewUrl || att.url}
                      alt={att.name || 'attachment'}
                      className="w-full h-full object-cover rounded-lg border border-gray-200 hover:border-[#B2BDA3] transition-all duration-200"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  
                  {/* Overlay for better mobile touch feedback */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 group-active:bg-black/20 rounded-lg transition-all duration-200" />
                  
                  {/* Mobile-optimized touch indicator */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="w-6 h-6 bg-white/80 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* Mobile-friendly image count indicator */}
          {imageAttachments.length > 1 && (
            <div className="mt-2 text-center">
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {imageAttachments.length} image{imageAttachments.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 📎 Other Attachments */}
      {otherAttachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {otherAttachments.map((att, idx) => {
            const fileType = getFileType(att.url) || att.type;
            
            // 🎙️ Special rendering for audio messages
            if (fileType === 'audio' || att.type === 'audio') {
              return (
                <motion.div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    isUser 
                      ? 'bg-atlas-sage/10 border-atlas-sage/30' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <Music className={`w-4 h-4 ${isUser ? 'text-atlas-sage' : 'text-purple-500'}`} />
                    <span className="text-sm font-medium text-gray-900">
                      {att.name || 'Voice Note'}
                    </span>
                  </div>
                  <audio 
                    controls 
                    src={att.url}
                    className="w-full h-8"
                    style={{ accentColor: isUser ? '#B2BDA3' : '#6B7280' }}
                  />
                </motion.div>
              );
            }
            
            return (
              <motion.div
                key={idx}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  isUser 
                    ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
                onClick={() => handleFileClick(att.url)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex-shrink-0 mr-3">
                  {fileType === 'video' && <Play className="w-5 h-5 text-red-500" />}
                  {fileType === 'pdf' && <FileText className="w-5 h-5 text-red-500" />}
                  {fileType === 'file' && <FileText className="w-5 h-5 text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {att.name || 'Attachment'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{fileType}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 🔍 Web-Compatible Image Viewer */}
      <ImageViewerModal
        visible={viewerVisible}
        onClose={handleCloseViewer}
        images={imageAttachments}
        startIndex={viewerIndex}
      />
    </>
  );
};
