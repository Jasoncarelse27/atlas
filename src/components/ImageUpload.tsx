import { Camera } from 'lucide-react';
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useFeatureAccess } from '../hooks/useTierAccess';
import { imageService } from '../services/imageService';
import { logger } from '../lib/logger';

interface ImageUploadProps {
  onImageProcessed: (result: { filePath: string; publicUrl: string; analysis: string }) => void;
  userId: string;
  className?: string;
}

export function ImageUpload({ onImageProcessed, userId, className = '' }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { canUse, attemptFeature } = useFeatureAccess('image');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ✅ Check tier access using centralized feature access hook
    const hasAccess = await attemptFeature();
    if (!hasAccess) {
      logger.debug('[ImageUpload] Tier check failed - upgrade required');
      return; // attemptFeature already shows upgrade modal
    }

    // Validate file
    if (!imageService.isFormatSupported(file.type)) {
      toast.error(`Unsupported format. Supported: ${imageService.getSupportedFormats().join(', ')}`);
      return;
    }

    if (file.size > imageService.getMaxFileSize()) {
      toast.error(`File too large. Max size: ${Math.round(imageService.getMaxFileSize() / 1024 / 1024)}MB`);
      return;
    }

    setIsProcessing(true);
    
    try {
      // Process image (upload + analysis)
      const result = await imageService.processImage(file, userId);
      
      toast.success('Image analyzed successfully!');
      onImageProcessed(result);
      
    } catch (error) {
      // ✅ Silent fail for service unavailable - don't spam console or show toast
      if (error instanceof Error && error.message === 'IMAGE_SERVICE_UNAVAILABLE') {
        logger.debug('[ImageUpload] Service unavailable - silently failing');
        return; // Exit silently, don't show error
      }
      
      // Only show errors for other cases
      logger.error('[ImageUpload] Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = async () => {
    const hasAccess = await attemptFeature();
    if (!hasAccess) {
      logger.debug('[ImageUpload] Tier check failed - upgrade required');
      return; // attemptFeature already shows upgrade modal
    }
    fileInputRef.current?.click();
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={handleClick}
        disabled={isProcessing || !canUse}
        className={`
          flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full transition-all duration-200 touch-manipulation
          min-h-[44px] min-w-[44px]
          ${canUse 
            ? 'bg-atlas-sage text-white hover:bg-atlas-success active:scale-95 active:bg-atlas-success' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }
          ${isProcessing ? 'opacity-50 cursor-wait' : ''}
        `}
        aria-label={isProcessing ? 'Analyzing image...' : 'Add image for analysis'}
        aria-disabled={isProcessing || !canUse}
      >
        {isProcessing ? (
          <>
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm sm:text-base">Analyzing...</span>
          </>
        ) : (
          <>
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base font-medium">Add Image</span>
          </>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isProcessing}
      />
    </div>
  );
}
