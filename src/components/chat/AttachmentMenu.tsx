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
  onAddAttachment?: (attachment: { id: string; type: string; url?: string; publicUrl?: string; file?: File }) => void;
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
  
  // ✅ FIX 3: Cache failed upload for retry
  const [failedUpload, setFailedUpload] = useState<{ file: File; error: string } | null>(null);
  
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

  // 🔹 Upload handler for images from gallery - adds to input area for caption
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isUploading) {
      logger.debug('[AttachmentMenu] Upload already in progress, ignoring duplicate trigger');
      return;
    }
    
    e.target.value = '';
    
    // Clear any previous failed upload
    setFailedUpload(null);
    
    await uploadImage(file);
  };
  
  // 🔹 Separate handler for camera capture to prevent duplicate uploads
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isUploading) {
      logger.debug('[AttachmentMenu] Camera upload already in progress, ignoring duplicate');
      return;
    }
    
    e.target.value = '';
    
    // Clear any previous failed upload
    setFailedUpload(null);
    
    await uploadImage(file);
  };

  // ✅ FIX 3: Retry failed upload
  const retryFailedUpload = async () => {
    if (!failedUpload) return;
    const file = failedUpload.file;
    setFailedUpload(null); // Clear error state
    await uploadImage(file);
  };

  // ✅ BEST PRACTICE: Upload with automatic retry and exponential backoff
  const uploadWithRetry = async (file: File, maxAttempts = 3): Promise<any> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        logger.debug(`[AttachmentMenu] Upload attempt ${attempt + 1}/${maxAttempts}`);
        return await imageService.uploadImage(file, userId);
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts - 1;
        
        // Check if error is retryable (network errors, timeouts)
        const isRetryable = error instanceof Error && (
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('fetch') ||
          error.message.includes('failed to fetch')
        );
        
        if (isLastAttempt || !isRetryable) {
          throw error; // Give up after max attempts or non-retryable errors
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt) * 1000;
        logger.debug(`[AttachmentMenu] Upload failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('Upload failed after all retry attempts');
  };

  // ✅ FIX 3: Extracted upload logic for reusability
  const uploadImage = async (file: File) => {
    setIsUploading(true);
    logger.debug('[AttachmentMenu] Starting single file upload');
    
    try {
      // Show compression toast for large files
      const fileSizeMB = file.size / 1024 / 1024;
      const needsCompression = fileSizeMB > 0.5; // Show toast for files > 500KB

      if (needsCompression) {
        toast.loading(
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">Optimizing image...</span>
            <span className="text-xs text-gray-500">Compressing {fileSizeMB.toFixed(1)}MB file</span>
          </div>,
          { 
            id: 'image-compression-loading',
            icon: <div className="w-5 h-5 border-2 border-[#8FA67E] border-t-transparent rounded-full animate-spin" />
          }
        );
      }

      toast.loading(
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">Uploading image...</span>
          <span className="text-xs text-gray-500">Preparing for analysis...</span>
        </div>,
        { 
          id: 'image-upload-loading',
          icon: <div className="w-5 h-5 border-2 border-[#8FA67E] border-t-transparent rounded-full animate-spin" />
        }
      );
      
      // ✅ BEST PRACTICE: Use automatic retry for better success rate
      const result = await uploadWithRetry(file, 3);
      
      logger.debug('✅ File uploaded successfully');

      if (onAddAttachment) {
        const attachment = {
          type: file.type.startsWith('image/') ? "image" as const : "file" as const,
          url: result.publicUrl,
          publicUrl: result.publicUrl,
          name: file.name,
          size: file.size,
          file: file,
        };
        onAddAttachment(attachment);
        
        logger.debug('✅ File added to input area for caption');
        if (needsCompression) toast.dismiss('image-compression-loading');
        toast.dismiss('image-upload-loading');
        toast.success(
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">Upload complete</span>
            <span className="text-xs text-gray-500">Add a caption and send</span>
          </div>,
          { 
            duration: 3000,
            icon: (
              <div className="w-5 h-5 rounded-full bg-[#8FA67E] flex items-center justify-center">
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
      toast.dismiss('image-compression-loading');
      toast.dismiss('image-upload-loading');
      
      // ✅ FIX 3: Cache failed upload and show retry option
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setFailedUpload({ file, error: errorMessage });
      
      toast.error(
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-900">Upload failed</span>
          <span className="text-xs text-gray-500">{errorMessage}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.dismiss();
              retryFailedUpload();
            }}
            className="mt-1 px-3 py-1 bg-[#8FA67E] hover:bg-[#7E9570] text-white text-xs rounded-lg transition-colors"
          >
            Retry Upload
          </button>
        </div>,
        { duration: 10000 } // Longer duration for retry button
      );
    } finally {
      setIsUploading(false);
      
      // ✅ BEST PRACTICE: Clear all refs to ensure clean state
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (mobileCameraInputRef.current) mobileCameraInputRef.current.value = '';
      
      onClose();
    }
  };

  // 🔹 Upload handler for files - adds to input area for caption (single file, professional UX)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isUploading) {
      logger.debug('[AttachmentMenu] Upload already in progress, ignoring duplicate trigger');
      return;
    }
    
    e.target.value = '';
    
    setIsUploading(true);
    logger.debug('[AttachmentMenu] Starting single file upload');
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
      
      const result = await imageService.uploadImage(file, userId);
      
      logger.debug('✅ File uploaded successfully');

      if (onAddAttachment) {
        const attachment = {
          type: file.type.startsWith('image/') ? "image" as const : "file" as const,
          url: result.publicUrl,
          publicUrl: result.publicUrl,
          name: file.name,
          size: file.size,
          file: file,
        };
        onAddAttachment(attachment);
        
        logger.debug('✅ File added to input area for caption');
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
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'NotAllowedError') {
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
              className="rounded-3xl bg-gradient-to-br from-[#F4E8E1] to-[#F3D3B8] shadow-2xl border-2 border-[#CEC1B8]"
              style={{
                boxShadow: '0 20px 60px rgba(151, 134, 113, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
              }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="p-4 sm:p-6">
                {/* Header */}
                <div className="text-center mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">Attach Media</h2>
                  <p className="text-gray-600 text-xs sm:text-sm">Choose what you'd like to share</p>
                </div>

                {/* Hidden inputs (triggered programmatically) */}
                <input
                  type="file"
                  accept="image/*,video/*"
                  ref={imageInputRef}
                  style={{ display: "none" }}
                  onChange={handleImageSelect}
                  aria-label="Select images or videos from gallery"
                />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={mobileCameraInputRef}
                  style={{ display: "none" }}
                  onChange={handleCameraCapture}
                  aria-label="Take photo with camera"
                />
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,audio/*"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                  aria-label="Select files to upload"
                />

                {/* Options - Attach File, Upload Image, and Take Photo */}
                <div className="space-y-2 sm:space-y-3">
                  {/* Choose Photo - Direct to gallery */}
                  <button
                    disabled={isUploading}
                    className={`w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl transition-all duration-200 border-2 group ${
                      isUploading 
                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                        : 'bg-white/80 hover:bg-[#D3DCAB]/30 border-[#CEC1B8] hover:border-[#D3DCAB] shadow-md hover:shadow-lg'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isUploading) {
                        imageInputRef.current?.click();
                      }
                    }}
                    aria-label="Choose photos or videos from gallery"
                    aria-disabled={isUploading}
                  >
                    <div className={`p-1.5 sm:p-2 rounded-xl transition-colors shadow-sm ${
                      isUploading 
                        ? 'bg-[#D3DCAB]/20' 
                        : 'bg-[#D3DCAB]/30 group-hover:bg-[#D3DCAB]/50'
                    }`}>
                      <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[#978671]" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-gray-900 font-medium text-sm sm:text-base">
                        {isUploading ? 'Uploading...' : 'Choose Photo'}
                      </div>
                      <div className="text-gray-600 text-xs sm:text-sm">
                        {isUploading ? 'Please wait...' : 'Select from gallery'}
                      </div>
                    </div>
                  </button>

                  {/* Take Photo - Direct to camera */}
                  <button
                    disabled={isUploading}
                    className={`w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl transition-all duration-200 border-2 group ${
                      isUploading 
                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                        : 'bg-white/80 hover:bg-[#D3DCAB]/30 border-[#CEC1B8] hover:border-[#D3DCAB] shadow-md hover:shadow-lg'
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
                    aria-label="Take photo with camera"
                    aria-disabled={isUploading}
                  >
                    <div className={`p-1.5 sm:p-2 rounded-xl transition-colors shadow-sm ${
                      isUploading 
                        ? 'bg-[#D3DCAB]/20' 
                        : 'bg-[#D3DCAB]/30 group-hover:bg-[#D3DCAB]/50'
                    }`}>
                      <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-[#978671]" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-gray-900 font-medium text-sm sm:text-base">
                        Take Photo
                      </div>
                      <div className="text-gray-600 text-xs sm:text-sm">
                        Open camera now
                      </div>
                    </div>
                  </button>

                  {/* Attach File */}
                  <button
                    disabled={isUploading}
                    className={`w-full flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all duration-200 border-2 group ${
                      isUploading 
                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                        : 'bg-white/80 hover:bg-[#D3DCAB]/30 border-[#CEC1B8] hover:border-[#D3DCAB] shadow-md hover:shadow-lg'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isUploading) {
                        fileInputRef.current?.click();
                      }
                    }}
                    aria-label="Attach files, documents, or PDFs"
                    aria-disabled={isUploading}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`p-1.5 sm:p-2 rounded-xl transition-colors shadow-sm ${
                        isUploading 
                          ? 'bg-[#D3DCAB]/20' 
                          : 'bg-[#D3DCAB]/30 group-hover:bg-[#D3DCAB]/50'
                      }`}>
                        <FileUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#978671]" />
                      </div>
                      <div className="text-left">
                        <div className="text-gray-900 font-medium text-sm sm:text-base">
                          {isUploading ? 'Uploading...' : 'Attach File'}
                        </div>
                        <div className="text-gray-600 text-xs sm:text-sm">
                          {isUploading ? 'Please wait...' : 'Upload documents, PDFs, and more'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  </button>
                </div>

                {/* Footer */}
                <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
                  <p className="text-gray-500 text-xs text-center">
                    Supported: Images, PDFs, Audio, Documents
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