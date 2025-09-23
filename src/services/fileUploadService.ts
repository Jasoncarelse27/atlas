import { createChatError } from '../features/chat/lib/errorHandler';
import { supabase } from '../lib/supabase';

export interface UploadResult {
  url: string;
  filePath: string;
  metadata: {
    filename: string;
    size: number;
    type: string;
    duration?: number; // for audio
    dimensions?: { width: number; height: number }; // for images
  };
}

export interface UploadOptions {
  bucket: string;
  folder?: string;
  maxSize?: number;
  allowedTypes?: string[];
}

class FileUploadService {
  private readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly DEFAULT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  private readonly DEFAULT_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/m4a'];

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    file: File, 
    userId: string, 
    type: 'image' | 'audio' | 'file',
    options?: UploadOptions
  ): Promise<UploadResult> {
    try {
      // Validate file
      this.validateFile(file, type, options);

      // Generate file path
      const timestamp = Date.now();
      const extension = file.name.split('.').pop() || 'bin';
      const filename = `${type}_${timestamp}_${crypto.randomUUID()}.${extension}`;
      const filePath = options?.folder ? `${options.folder}/${filename}` : filename;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(options?.bucket || this.getBucketForType(type))
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(options?.bucket || this.getBucketForType(type))
        .getPublicUrl(filePath);

      // Create metadata
      const metadata: UploadResult['metadata'] = {
        filename: file.name,
        size: file.size,
        type: file.type,
      };

      // Add type-specific metadata
      if (type === 'image') {
        const dimensions = await this.getImageDimensions(file);
        metadata.dimensions = dimensions;
      }

      return {
        url: urlData.publicUrl,
        filePath: data.path,
        metadata,
      };
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'uploadFile',
        timestamp: new Date().toISOString(),
        metadata: { type, filename: file.name, size: file.size },
      });
      throw chatError;
    }
  }

  /**
   * Upload image file
   */
  async uploadImage(file: File, userId: string): Promise<UploadResult> {
    return this.uploadFile(file, userId, 'image', {
      bucket: 'images',
      folder: userId,
      maxSize: this.DEFAULT_MAX_SIZE,
      allowedTypes: this.DEFAULT_IMAGE_TYPES,
    });
  }

  /**
   * Upload audio file
   */
  async uploadAudio(file: File, userId: string): Promise<UploadResult> {
    return this.uploadFile(file, userId, 'audio', {
      bucket: 'voice-recordings',
      folder: userId,
      maxSize: this.DEFAULT_MAX_SIZE,
      allowedTypes: this.DEFAULT_AUDIO_TYPES,
    });
  }

  /**
   * Upload camera capture (image blob)
   */
  async uploadCameraCapture(blob: Blob, userId: string): Promise<UploadResult> {
    const file = new File([blob], 'camera.jpg', { type: 'image/jpeg' });
    return this.uploadImage(file, userId);
  }

  /**
   * Upload audio recording (audio blob)
   */
  async uploadAudioRecording(blob: Blob, userId: string): Promise<UploadResult> {
    const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
    return this.uploadAudio(file, userId);
  }

  /**
   * Validate file before upload
   */
  private validateFile(file: File, type: string, options?: UploadOptions): void {
    const maxSize = options?.maxSize || this.DEFAULT_MAX_SIZE;
    const allowedTypes = options?.allowedTypes || this.getAllowedTypesForType(type);

    if (file.size > maxSize) {
      throw new Error(`File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`);
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`);
    }
  }

  /**
   * Get bucket name for file type
   */
  private getBucketForType(type: string): string {
    switch (type) {
      case 'image':
        return 'images';
      case 'audio':
        return 'voice-recordings';
      default:
        return 'files';
    }
  }

  /**
   * Get allowed file types for type
   */
  private getAllowedTypesForType(type: string): string[] {
    switch (type) {
      case 'image':
        return this.DEFAULT_IMAGE_TYPES;
      case 'audio':
        return this.DEFAULT_AUDIO_TYPES;
      default:
        return ['*/*'];
    }
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      img.src = URL.createObjectURL(file);
    });
  }
}

export const fileUploadService = new FileUploadService();
