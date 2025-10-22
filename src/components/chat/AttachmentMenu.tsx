import { AnimatePresence, motion } from "framer-motion";
import { Camera, ChevronRight, FileUp, Image as ImageIcon, RefreshCw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Removed sendMessageWithAttachments import - using callback pattern instead
import { useFeatureAccess } from "@/hooks/useTierAccess";
import { logger } from '../../lib/logger';
import { imageService } from "../../services/imageService";
// Removed useMessageStore import - using callback pattern instead

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string; // Made optional since we're using callback pattern
  userId: string;
  onAddAttachment?: (attachment: any) => void; // New callback for adding to input area
}

const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  isOpen,
  onClose,
  userId,
  onAddAttachment,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // 📸 Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);
  
  // Tier access for camera feature
  const { canUse: canUseCamera, attemptFeature: attemptCamera } = useFeatureAccess('camera'); // canUseCamera kept for future use
  
  // Suppress unused variable warning
  void canUseCamera;
  
  // Detect mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Removed useMessageStore - using onAddAttachment callback instead

  // 🔹 Upload handler for images - adds to input area for caption
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isUploading) {
      logger.debug('[AttachmentMenu] Upload already in progress, ignoring duplicate trigger');
      return; // ✅ Prevent duplicate uploads
    }
    
    // ✅ BEST PRACTICE: Clear input value immediately to prevent re-triggering
    e.target.value = '';
    
    setIsUploading(true);
    logger.debug('[AttachmentMenu] Starting image upload:', file.name);
    
    try {
      toast.loading(
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">Uploading file</span>
          <span className="text-xs text-gray-500">Preparing for analysis...</span>
        </div>,
        { 
          id: 'image-upload-loading',
          icon: <div className="w-5 h-5 border-2 border-[#B2BDA3] border-t-transparent rounded-full animate-spin" />
        }
      );
      
      // Use the existing imageService for upload (now uses attachments bucket)
      const result = await imageService.uploadImage(file, userId);
      
      logger.debug("✅ Uploaded file:", result);

      // Create attachment object for input area
      const attachment = {
        type: file.type.startsWith('image/') ? "image" as const : "file" as const,
        url: result.publicUrl,
        publicUrl: result.publicUrl, // Keep both for compatibility
        name: file.name,
        size: file.size,
        file: file, // Keep original file for compatibility
      };

      // If we have the callback, add to input area instead of sending immediately
      if (onAddAttachment) {
        onAddAttachment(attachment);
        logger.debug("✅ File added to input area for caption");
        toast.dismiss('image-upload-loading');
        toast.success(
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">Upload complete</span>
            <span className="text-xs text-gray-500">Add a caption and send</span>
          </div>,
          { 
            duration: 3000,
            icon: (
              <div className="w-5 h-5 rounded-full bg-[#B2BDA3] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )
          }
        );
          } else {
            // Fallback to old behavior if no callback provided
            toast.dismiss('image-upload-loading');
            toast.success(
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">Upload complete</span>
                <span className="text-xs text-gray-500">Add a caption and send</span>
              </div>,
              { 
                duration: 3000,
                icon: (
                  <div className="w-5 h-5 rounded-full bg-[#B2BDA3] flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )
              }
            );
          }

    } catch (err) {
      logger.error('[AttachmentMenu] Image upload failed:', err);
      toast.dismiss('image-upload-loading');
      toast.error("Upload failed - check console for details");
    } finally {
      setIsUploading(false);
      
      // ✅ BEST PRACTICE: Clear all refs to ensure clean state
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (mobileCameraInputRef.current) mobileCameraInputRef.current.value = '';
      
      onClose();
    }
  };

  // 🔹 Upload handler for files - adds to input area for caption
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isUploading) {
      logger.debug('[AttachmentMenu] Upload already in progress, ignoring duplicate trigger');
      return; // ✅ Prevent duplicate uploads
    }
    
    // ✅ BEST PRACTICE: Clear input value immediately to prevent re-triggering
    e.target.value = '';
    
    setIsUploading(true);
    logger.debug('[AttachmentMenu] Starting file upload:', file.name);
    try {
      toast.loading(
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">Uploading file</span>
          <span className="text-xs text-gray-500">Preparing for analysis...</span>
        </div>,
        { 
          id: 'file-upload-loading',
          icon: <div className="w-5 h-5 border-2 border-[#B2BDA3] border-t-transparent rounded-full animate-spin" />
        }
      );
      
      // Use the existing imageService for upload (now uses attachments bucket)
      const result = await imageService.uploadImage(file, userId);
      
      logger.debug("✅ Uploaded file:", result);

      // Create attachment object for input area
      const attachment = {
        type: file.type.startsWith('image/') ? "image" as const : "file" as const,
        url: result.publicUrl,
        publicUrl: result.publicUrl, // Keep both for compatibility
        name: file.name,
        size: file.size,
        file: file, // Keep original file for compatibility
      };

      // If we have the callback, add to input area instead of sending immediately
      if (onAddAttachment) {
        onAddAttachment(attachment);
        logger.debug("✅ File added to input area for caption");
        toast.dismiss('file-upload-loading');
        toast.success(
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">Upload complete</span>
            <span className="text-xs text-gray-500">Add a caption and send</span>
          </div>,
          { 
            duration: 3000,
            icon: (
              <div className="w-5 h-5 rounded-full bg-[#B2BDA3] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )
          }
        );
          } else {
            // Fallback to old behavior if no callback provided
            toast.dismiss('file-upload-loading');
            toast.success(
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">Upload complete</span>
                <span className="text-xs text-gray-500">Add a caption and send</span>
              </div>,
              { 
                duration: 3000,
                icon: (
                  <div className="w-5 h-5 rounded-full bg-[#B2BDA3] flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )
              }
            );
          }

    } catch (err) {
      logger.error('[AttachmentMenu] File upload failed:', err);
      toast.dismiss('file-upload-loading');
      toast.error("Upload failed - check console for details");
    } finally {
      setIsUploading(false);
      
      // ✅ BEST PRACTICE: Clear file input ref to ensure clean state
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      onClose();
    }
  };

  // 📸 Camera functions
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: isMobile ? 1920 : 1280 },
          height: { ideal: isMobile ? 1080 : 720 }
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraOpen(true);
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        toast.error('Camera access denied. Please allow camera access.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera found on this device.');
      } else {
        toast.error('Camera access failed. Please try again.');
      }
    }
  };

  const closeCamera = () => {
    stream?.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
    setStream(null);
  };

  const toggleCamera = async () => {
    // Stop current stream
    stream?.getTracks().forEach(track => track.stop());
    
    // Switch facing mode
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    // Restart camera with new facing mode
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: newFacingMode,
          width: { ideal: isMobile ? 1920 : 1280 },
          height: { ideal: isMobile ? 1080 : 720 }
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      toast.error('Failed to switch camera');
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);
    
    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      
      // Stop camera stream
      stream?.getTracks().forEach(track => track.stop());
      setIsCameraOpen(false);
      
      // Create File object
      const file = new File([blob], `camera-${Date.now()}.png`, { type: 'image/png' });
      
      // Use existing upload flow
      setIsUploading(true);
      try {
        toast.loading(
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">Uploading photo</span>
            <span className="text-xs text-gray-500">Preparing for analysis...</span>
          </div>,
          { 
            id: 'camera-upload-loading',
            icon: <div className="w-5 h-5 border-2 border-[#B2BDA3] border-t-transparent rounded-full animate-spin" />
          }
        );
        
        const result = await imageService.uploadImage(file, userId);
        const attachment = {
          type: "image" as const,
          url: result.publicUrl,
          publicUrl: result.publicUrl,
          name: file.name,
          size: file.size,
          file: file,
        };
        
        if (onAddAttachment) {
          onAddAttachment(attachment);
          toast.dismiss('camera-upload-loading');
          toast.success(
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">Photo captured</span>
              <span className="text-xs text-gray-500">Add a caption and send</span>
            </div>,
            { 
              duration: 3000,
              icon: (
                <div className="w-5 h-5 rounded-full bg-[#B2BDA3] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )
            }
          );
        }
      } catch (error) {
        toast.dismiss('camera-upload-loading');
        toast.error('Failed to upload photo');
      } finally {
        setIsUploading(false);
        onClose();
      }
    }, 'image/png');
  };

  const handleCameraClick = async () => {
    const hasAccess = await attemptCamera();
    if (!hasAccess) {
      toast.error(
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">Studio Tier Required</span>
          <span className="text-xs text-gray-500">Upgrade to use camera features</span>
        </div>,
        { duration: 4000 }
      );
      return;
    }
    startCamera();
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Positioned above the + button - Mobile friendly */}
          <motion.div
            data-attachment-menu
            className="absolute bottom-12 left-1/2 -translate-x-1/2 w-72 sm:w-80 max-w-[95vw] z-50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="rounded-3xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 shadow-2xl border border-slate-700/50"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="p-4 sm:p-6">
                {/* Header */}
                <div className="text-center mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Attach Media</h2>
                  <p className="text-white/70 text-xs sm:text-sm">Choose what you'd like to share</p>
                </div>

                {/* Hidden inputs (triggered programmatically) */}
                <input
                  type="file"
                  accept="image/*,video/*"
                  ref={imageInputRef}
                  style={{ display: "none" }}
                  onChange={handleImageSelect}
                />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={mobileCameraInputRef}
                  style={{ display: "none" }}
                  onChange={handleImageSelect}
                />
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,audio/*"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />

                {/* Options - Attach File, Upload Image, and Take Photo */}
                <div className="space-y-2 sm:space-y-3">
                  {/* Choose Photo - Direct to gallery */}
                  <button
                    disabled={isUploading}
                    className={`w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl transition-all duration-200 border group ${
                      isUploading 
                        ? 'bg-slate-700/20 border-slate-600/20 cursor-not-allowed opacity-60' 
                        : 'bg-slate-700/30 hover:bg-slate-700/50 active:bg-slate-700/60 border-slate-600/30 hover:border-slate-500/50'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isUploading) {
                        imageInputRef.current?.click();
                      }
                    }}
                  >
                    <div className={`p-1.5 sm:p-2 rounded-xl transition-colors ${
                      isUploading 
                        ? 'bg-emerald-600/10' 
                        : 'bg-emerald-600/20 group-hover:bg-emerald-600/30'
                    }`}>
                      <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-white font-medium text-sm sm:text-base">
                        {isUploading ? 'Uploading...' : 'Choose Photo'}
                      </div>
                      <div className="text-slate-300 text-xs sm:text-sm">
                        {isUploading ? 'Please wait...' : 'Select from gallery'}
                      </div>
                    </div>
                  </button>

                  {/* Take Photo - Direct to camera */}
                  <button
                    disabled={isUploading}
                    className={`w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl transition-all duration-200 border group ${
                      isUploading 
                        ? 'bg-slate-700/20 border-slate-600/20 cursor-not-allowed opacity-60' 
                        : 'bg-slate-700/30 hover:bg-slate-700/50 active:bg-slate-700/60 border-slate-600/30 hover:border-slate-500/50'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isUploading) {
                        // Mobile: Use native camera input (opens device camera directly)
                        // Desktop: Use WebRTC camera (in-app camera with preview)
                        if (isMobile) {
                          mobileCameraInputRef.current?.click();
                        } else {
                          handleCameraClick();
                        }
                      }
                    }}
                  >
                    <div className={`p-1.5 sm:p-2 rounded-xl transition-colors ${
                      isUploading 
                        ? 'bg-[#B2BDA3]/10' 
                        : 'bg-[#B2BDA3]/20 group-hover:bg-[#B2BDA3]/30'
                    }`}>
                      <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-[#B2BDA3]" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-white font-medium text-sm sm:text-base">
                        Take Photo
                      </div>
                      <div className="text-slate-300 text-xs sm:text-sm">
                        Open camera now
                      </div>
                    </div>
                  </button>

                  {/* Attach File */}
                  <button
                    disabled={isUploading}
                    className={`w-full flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all duration-200 border group ${
                      isUploading 
                        ? 'bg-slate-700/20 border-slate-600/20 cursor-not-allowed opacity-60' 
                        : 'bg-slate-700/30 hover:bg-slate-700/50 active:bg-slate-700/60 border-slate-600/30 hover:border-slate-500/50'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isUploading) {
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`p-1.5 sm:p-2 rounded-xl transition-colors ${
                        isUploading 
                          ? 'bg-blue-600/10' 
                          : 'bg-blue-600/20 group-hover:bg-blue-600/30'
                      }`}>
                        <FileUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium text-sm sm:text-base">
                          {isUploading ? 'Uploading...' : 'Attach File'}
                        </div>
                        <div className="text-slate-300 text-xs sm:text-sm">
                          {isUploading ? 'Please wait...' : 'Upload documents, PDFs, and more'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                  </button>
                </div>

                {/* Footer */}
                <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-600/30">
                  <p className="text-slate-400 text-xs text-center">
                    Supported formats: Images, PDFs, Audio, Documents
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* 📸 Camera Modal - Mobile Optimized */}
    {isCameraOpen && (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ WebkitPlaysinline: 'true' } as React.CSSProperties}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Mobile-friendly controls */}
        <div 
          className="absolute bottom-0 left-0 right-0 pb-8 pt-6 bg-gradient-to-t from-black/80 to-transparent"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex flex-col items-center gap-4">
            {/* Camera flip toggle (mobile only) */}
            {isMobile && (
              <button
                onClick={toggleCamera}
                className="px-4 py-2 bg-white/10 text-white rounded-full hover:bg-white/20 flex items-center gap-2 min-h-[44px]"
              >
                <RefreshCw className="w-4 h-4" />
                Flip Camera
              </button>
            )}
            
            {/* Large capture button */}
            <button
              onClick={capturePhoto}
              className="w-16 h-16 bg-[#B2BDA3] text-white rounded-full hover:bg-[#A3B295] flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <Camera className="w-8 h-8" />
            </button>
            
            {/* Cancel button */}
            <button
              onClick={closeCamera}
              className="px-6 py-3 bg-white/10 text-white rounded-full hover:bg-white/20 min-h-[44px] min-w-[100px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default AttachmentMenu;