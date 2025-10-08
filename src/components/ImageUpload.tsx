import { Camera } from 'lucide-react';
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTierAccess } from '../hooks/useTierAccess';
import { imageService } from '../services/imageService';

interface ImageUploadProps {
  onImageProcessed: (result: { filePath: string; publicUrl: string; analysis: string }) => void;
  userId: string;
  className?: string;
}

export function ImageUpload({ onImageProcessed, userId, className = '' }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { hasAccess, showUpgradeModal } = useTierAccess();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check tier access
    if (!hasAccess('image')) {
      showUpgradeModal('image');
      return;
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
      toast.error(error instanceof Error ? error.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    if (!hasAccess('image')) {
      showUpgradeModal('image');
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={handleClick}
        disabled={isProcessing || !hasAccess('image')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200
          ${hasAccess('image') 
            ? 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }
          ${isProcessing ? 'opacity-50 cursor-wait' : ''}
        `}
      >
        {isProcessing ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
            <span>Add Image</span>
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
