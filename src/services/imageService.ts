import { createChatError } from '../features/chat/lib/errorHandler';
import { supabase } from '../lib/supabase';

export interface ImageMetadata {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  dimensions: {
    width: number;
    height: number;
  };
  uploadedAt: string;
  bucket: string;
}

export interface UploadResult {
  url: string;
  metadata: ImageMetadata;
}

class ImageService {
  private readonly STORAGE_BUCKET = 'chat-images';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly SUPPORTED_FORMATS = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif'
  ];

  /**
   * Upload image to Supabase Storage
   */
  async uploadImage(file: File): Promise<UploadResult> {
    try {
      // Validate file
      this.validateImageFile(file);

      // Generate unique filename
      const filename = this.generateFilename(file);
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .upload(filename, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(filename);

      // Get image dimensions
      const dimensions = await this.getImageDimensions(file);

      // Create metadata
      const metadata: ImageMetadata = {
        id: data.path,
        url: urlData.publicUrl,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        dimensions,
        uploadedAt: new Date().toISOString(),
        bucket: this.STORAGE_BUCKET,
      };

      return {
        url: urlData.publicUrl,
        metadata,
      };
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'uploadImage',
        filename: file.name,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Delete image from Supabase Storage
   */
  async deleteImage(imageId: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .remove([imageId]);

      if (error) throw error;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'deleteImage',
        imageId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get image by ID
   */
  async getImage(imageId: string): Promise<ImageMetadata | null> {
    // This would typically query a database table for image metadata
    // For now, we'll return null as we don't have a dedicated images table
    return null;
  }

  /**
   * Get images by conversation ID
   */
  async getImagesByConversation(conversationId: string): Promise<ImageMetadata[]> {
    // This would query a database table for images in a conversation
    // For now, we'll return an empty array
    return [];
  }

  /**
   * Resize image before upload (optional optimization)
   */
  async resizeImage(file: File, maxWidth: number = 1920, maxHeight: number = 1080): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to resize image'));
            }
          },
          file.type,
          0.8 // Quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate unique filename
   */
  private generateFilename(file: File): string {
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const extension = file.name.split('.').pop() || 'jpg';
    return `image_${timestamp}_${randomId}.${extension}`;
  }

  /**
   * Get image dimensions
   */
  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      
      img.onerror = () => {
        // Fallback dimensions if we can't get them
        resolve({ width: 0, height: 0 });
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Validate image file before upload
   */
  private validateImageFile(file: File): void {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`Image file too large. Maximum size is ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check file format
    if (!this.SUPPORTED_FORMATS.includes(file.type)) {
      throw new Error(`Unsupported image format. Supported formats: ${this.SUPPORTED_FORMATS.join(', ')}`);
    }

    // Check if file is empty
    if (file.size === 0) {
      throw new Error('Image file is empty');
    }
  }

  /**
   * Get supported image formats
   */
  getSupportedFormats(): string[] {
    return [...this.SUPPORTED_FORMATS];
  }

  /**
   * Get maximum file size
   */
  getMaxFileSize(): number {
    return this.MAX_FILE_SIZE;
  }

  /**
   * Check if image format is supported
   */
  isFormatSupported(mimeType: string): boolean {
    return this.SUPPORTED_FORMATS.includes(mimeType);
  }

  /**
   * Get storage bucket name
   */
  getStorageBucket(): string {
    return this.STORAGE_BUCKET;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if image is too large for optimal viewing
   */
  isImageTooLarge(dimensions: { width: number; height: number }): boolean {
    return dimensions.width > 1920 || dimensions.height > 1080;
  }

  /**
   * Get optimal dimensions for display
   */
  getOptimalDimensions(width: number, height: number, maxWidth: number = 800, maxHeight: number = 600): { width: number; height: number } {
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height };
    }

    const ratio = Math.min(maxWidth / width, maxHeight / height);
    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
    };
  }
}

export const imageService = new ImageService();
export default imageService;
