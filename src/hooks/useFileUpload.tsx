import React, { useState } from 'react';
import { toast } from 'sonner';
import { logger } from '../lib/logger';
import { imageService } from '../services/imageService';
import { supabase } from '../lib/supabaseClient';
import { generateUUID } from '../utils/uuid';
import { useFeatureAccess } from './useTierAccess';
import { useUpgradeModals } from '../contexts/UpgradeModalContext';

interface UploadOptions {
  userId: string;
  onSuccess?: (attachment: Attachment) => void;
  showCompressionToast?: boolean;
}

interface Attachment {
  id: string;
  type: 'image' | 'file';
  url?: string;
  publicUrl?: string;
  name?: string;
  size?: number;
  file?: File;
}

/**
 * ✅ MODERN: Unified file upload hook
 * Consolidates all upload logic into one reusable hook
 */
export function useFileUpload({ userId, onSuccess, showCompressionToast = true }: UploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [failedUpload, setFailedUpload] = useState<{ file: File; error: string } | null>(null);
  
  // ✅ CRITICAL: Add tier access checks for bypass prevention
  const { attemptFeature: attemptImage } = useFeatureAccess('image');
  const { attemptFeature: attemptFile } = useFeatureAccess('file');
  const { attemptFeature: attemptCamera } = useFeatureAccess('camera');
  const { showGenericUpgrade } = useUpgradeModals();

  // ✅ BEST PRACTICE: Upload with automatic retry and exponential backoff
  const uploadWithRetry = async (file: File, maxAttempts = 3): Promise<any> => {
    const isImage = file.type.startsWith('image/');
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        logger.debug(`[useFileUpload] Upload attempt ${attempt + 1}/${maxAttempts} (${isImage ? 'image' : 'file'})`);
        
        if (isImage) {
          // Use image service for images (handles compression, thumbnails)
        return await imageService.uploadImage(file, userId);
        } else {
          // Upload non-image files directly to Supabase storage
          const filePath = `${userId}/${Date.now()}-${file.name}`;
          const { data, error } = await supabase.storage
            .from('attachments')
            .upload(filePath, file, {
              contentType: file.type,
              cacheControl: '3600',
              upsert: false,
            });
          
          if (error) throw error;
          
          const { data: urlData } = supabase.storage
            .from('attachments')
            .getPublicUrl(filePath);
          
          return {
            filePath: data.path,
            publicUrl: urlData.publicUrl,
            thumbnailUrl: urlData.publicUrl, // No thumbnail for non-images
          };
        }
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
        logger.debug(`[useFileUpload] Upload failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('Upload failed after all retry attempts');
  };

  const uploadFile = async (file: File, source: 'gallery' | 'camera' | 'file' = 'file') => {
    if (isUploading) {
      logger.debug('[useFileUpload] Upload already in progress, ignoring duplicate trigger');
      return;
    }

    // ✅ CRITICAL: Tier validation BEFORE upload (bypass prevention)
    // This prevents direct hook calls from bypassing tier checks
    let hasAccess = false;
    if (source === 'gallery') {
      hasAccess = await attemptImage();
    } else if (source === 'file') {
      hasAccess = await attemptFile();
    } else if (source === 'camera') {
      hasAccess = await attemptCamera();
    }
    
    if (!hasAccess) {
      logger.warn(`[useFileUpload] Tier check failed for ${source} - upload blocked`);
      // attemptFeature already shows upgrade modal via toast, but ensure upgrade modal shows
      if (source === 'gallery') {
        showGenericUpgrade('image');
      } else if (source === 'file') {
        showGenericUpgrade('file');
      } else if (source === 'camera') {
        showGenericUpgrade('camera');
      }
      return;
    }

    setIsUploading(true);
    setFailedUpload(null);
    logger.debug(`[useFileUpload] Starting upload from ${source}`);

    try {
      // Show compression toast for large image files only
      const isImage = file.type.startsWith('image/');
      const fileSizeMB = file.size / 1024 / 1024;
      const needsCompression = isImage && showCompressionToast && fileSizeMB > 0.5;

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
          <span className="text-sm font-medium text-gray-900">Uploading {source === 'camera' ? 'photo' : source === 'gallery' ? 'image' : 'file'}...</span>
          <span className="text-xs text-gray-500">Preparing for analysis...</span>
        </div>,
        { 
          id: 'file-upload-loading',
          icon: <div className="w-5 h-5 border-2 border-[#8FA67E] border-t-transparent rounded-full animate-spin" />
        }
      );

      // ✅ BEST PRACTICE: Use automatic retry for better success rate
      const result = await uploadWithRetry(file, 3);
      
      logger.debug('✅ File uploaded successfully');

      const attachment: Attachment = {
        id: generateUUID(),
        type: file.type.startsWith('image/') ? 'image' : 'file',
        url: result.publicUrl,
        publicUrl: result.publicUrl,
        name: file.name,
        size: file.size,
        file: file,
      };

      if (onSuccess) {
        onSuccess(attachment);
      }

      if (needsCompression) toast.dismiss('image-compression-loading');
      toast.dismiss('file-upload-loading');
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

      return attachment;
    } catch (err) {
      logger.error('[useFileUpload] Upload failed:', err);
      toast.dismiss('image-compression-loading');
      toast.dismiss('file-upload-loading');
      
      // ✅ Cache failed upload and show retry option
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
              retryUpload();
            }}
            className="mt-1 px-3 py-1 bg-[#8FA67E] hover:bg-[#7E9570] text-white text-xs rounded-lg transition-colors"
          >
            Retry Upload
          </button>
        </div>,
        { duration: 10000 } // Longer duration for retry button
      );

      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const retryUpload = async () => {
    if (!failedUpload) return;
    const file = failedUpload.file;
    setFailedUpload(null);
    await uploadFile(file);
  };

  return {
    uploadFile,
    isUploading,
    failedUpload,
    retryUpload,
  };
}

