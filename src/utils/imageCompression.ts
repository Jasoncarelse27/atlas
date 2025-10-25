// Image Compression Utility
// Optimizes images before upload for faster uploads and lower storage costs

import { logger } from '../lib/logger';

interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  convertToJPEG?: boolean;
}

/**
 * Compress an image file for upload
 * 
 * @param file - Original image file
 * @param options - Compression options
 * @returns Compressed image file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxSizeMB = 1, // 1MB max by default
    maxWidthOrHeight = 2048, // 2048px max dimension
    quality = 0.85, // 85% quality (good balance)
    convertToJPEG = true, // Convert HEIC/HEIF to JPEG
  } = options;

  const startTime = performance.now();
  const originalSize = file.size;

  try {
    // Convert HEIC/HEIF to JPEG for compatibility
    const shouldConvert = convertToJPEG && (
      file.type === 'image/heic' || 
      file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif')
    );

    // Skip compression for small files (already under 500KB)
    if (originalSize < 500 * 1024 && !shouldConvert) {
      logger.debug('[ImageCompression] File already small, skipping compression');
      return file;
    }

    // Create image element
    const img = await createImageFromFile(file);

    // Calculate new dimensions
    let { width, height } = img;
    if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
      if (width > height) {
        height = Math.round((height * maxWidthOrHeight) / width);
        width = maxWidthOrHeight;
      } else {
        width = Math.round((width * maxWidthOrHeight) / height);
        height = maxWidthOrHeight;
      }
    }

    // Create canvas and compress
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Draw image with proper scaling
    ctx.fillStyle = '#FFFFFF'; // White background for JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to blob with compression
    const outputType = shouldConvert || file.type === 'image/png' ? 'image/jpeg' : file.type;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to compress image'));
        },
        outputType,
        quality
      );
    });

    // If still too large, reduce quality further
    let finalBlob = blob;
    let currentQuality = quality;
    const maxSize = maxSizeMB * 1024 * 1024;

    while (finalBlob.size > maxSize && currentQuality > 0.3) {
      currentQuality -= 0.1;
      logger.debug(`[ImageCompression] Still too large (${(finalBlob.size / 1024 / 1024).toFixed(2)}MB), reducing quality to ${currentQuality}`);
      
      finalBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to compress image'));
          },
          outputType,
          currentQuality
        );
      });
    }

    // Create new file
    const extension = outputType === 'image/jpeg' ? 'jpg' : file.name.split('.').pop();
    const fileName = file.name.replace(/\.(heic|heif|png)$/i, `.${extension}`);
    const compressedFile = new File([finalBlob], fileName, {
      type: outputType,
      lastModified: Date.now(),
    });

    const compressionTime = Math.round(performance.now() - startTime);
    const compressionRatio = ((1 - compressedFile.size / originalSize) * 100).toFixed(1);

    logger.info(
      `[ImageCompression] ✅ Compressed ${file.name}:`,
      `${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
      `(${compressionRatio}% reduction) in ${compressionTime}ms`
    );

    return compressedFile;
  } catch (error) {
    logger.error('[ImageCompression] Compression failed:', error);
    logger.warn('[ImageCompression] Falling back to original file');
    return file; // Fallback to original file on error
  }
}

/**
 * Create an Image element from a File
 */
function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(jpe?g|png|gif|webp|heic|heif)$/i)) {
    return { valid: false, error: 'Unsupported file format. Use JPEG, PNG, GIF, or WebP.' };
  }

  // Check file size (max 20MB original - will be compressed down)
  const maxOriginalSize = 20 * 1024 * 1024;
  if (file.size > maxOriginalSize) {
    return { valid: false, error: 'File too large. Maximum size is 20MB.' };
  }

  return { valid: true };
}

