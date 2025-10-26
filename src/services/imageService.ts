import { logger } from '../lib/logger';
import { supabase } from "../lib/supabaseClient";
import { compressImage, createThumbnail, validateImageFile } from '../utils/imageCompression';

// Event logging helper
const logEvent = (eventName: string, props: Record<string, unknown>) => {
  if (process.env.NODE_ENV !== "production") {
    // Log events in development
  }
};

export const imageService = {
  async uploadImage(file: File, userId: string) {
    logEvent("image_upload_start", { fileName: file.name, size: file.size, type: file.type });

    // ✅ VALIDATE FILE BEFORE UPLOAD
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // ✅ COMPRESS IMAGE BEFORE UPLOAD (Best Practice for Mobile)
    const compressedFile = await compressImage(file, {
      maxSizeMB: 1, // 1MB max for fast mobile uploads
      maxWidthOrHeight: 2048, // 2048px max dimension
      quality: 0.85, // 85% quality
      convertToJPEG: true, // Convert HEIC to JPEG
    });

    // ✅ CREATE THUMBNAIL for faster chat rendering
    logger.debug('[ImageService] Creating thumbnail...');
    const thumbnailFile = await createThumbnail(compressedFile, 400, 0.7);

    // Log upload start to Supabase (with compressed size)
    // @ts-expect-error - image_events table type not generated
    await supabase.from("image_events").insert({
      user_id: userId,
      event_name: "image_upload_start",
      metadata: { 
        name: compressedFile.name, 
        originalSize: file.size,
        compressedSize: compressedFile.size,
        thumbnailSize: thumbnailFile.size,
        compressionRatio: ((1 - compressedFile.size / file.size) * 100).toFixed(1) + '%',
        type: compressedFile.type 
      },
    });

    const filePath = `${userId}/${Date.now()}-${compressedFile.name}`;
    const thumbnailPath = `${userId}/${Date.now()}-${thumbnailFile.name}`;

    // Upload both full image and thumbnail
    const [uploadResult, thumbnailResult] = await Promise.all([
      supabase.storage.from("attachments").upload(filePath, compressedFile),
      supabase.storage.from("attachments").upload(thumbnailPath, thumbnailFile)
    ]);

    if (uploadResult.error) {
      logEvent("image_upload_fail", { error: uploadResult.error.message });
      // @ts-expect-error - image_events table type not generated
      await supabase.from("image_events").insert({
        user_id: userId,
        event_name: "image_upload_fail",
        metadata: { error: uploadResult.error.message },
      });
      throw uploadResult.error;
    }

    if (thumbnailResult.error) {
      logger.warn('[ImageService] Thumbnail upload failed (non-critical):', thumbnailResult.error);
      // Continue without thumbnail - it's not critical
    }

    logEvent("image_upload_complete", { filePath, size: compressedFile.size, originalSize: file.size });

    // Log upload success to Supabase (with compression metrics)
    // @ts-expect-error - image_events table type not generated
    await supabase.from("image_events").insert({
      user_id: userId,
      event_name: "image_upload_complete",
      file_path: filePath,
      file_size: compressedFile.size,
      metadata: { 
        compressedSize: compressedFile.size, 
        originalSize: file.size,
        thumbnailSize: thumbnailFile.size,
        compressionRatio: ((1 - compressedFile.size / file.size) * 100).toFixed(1) + '%',
        type: compressedFile.type 
      },
    });

    const publicUrl = this.getPublicUrl(filePath);
    const thumbnailUrl = thumbnailResult.error ? publicUrl : this.getPublicUrl(thumbnailPath);

    return { 
      filePath, 
      publicUrl, 
      url: publicUrl,
      thumbnailUrl, // ✅ NEW: Return thumbnail URL for faster chat rendering
      thumbnailPath: thumbnailResult.error ? null : thumbnailPath
    };
  },

  getPublicUrl(path: string) {
    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    return data.publicUrl;
  },

  async scanImage(filePath: string, userId: string, prompt?: string) {
    logEvent("image_scan_request", { filePath });

    // Log scan request to Supabase
    // @ts-expect-error - image_events table type not generated
    await supabase.from("image_events").insert({
      user_id: userId,
      event_name: "image_scan_request",
      file_path: filePath,
      metadata: { model: "claude-3-5-sonnet-20241022" },
    });

    // Get the public URL for the image
    const imageUrl = this.getPublicUrl(filePath);

    // Call our backend image analysis endpoint
    // ✅ FIX: Use relative URL for proper proxy routing (like chatService.ts does)
    const res = await fetch('/api/image-analysis', {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ 
        imageUrl, 
        userId, 
        prompt: prompt || "Analyze this image and provide detailed insights about what you see."
      }),
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = errorData.details || errorData.error || "Image analysis failed";
      
      logEvent("image_scan_fail", { error: errorMessage });
      // @ts-expect-error - image_events table type not generated
      await supabase.from("image_events").insert({
        user_id: userId,
        event_name: "image_scan_fail",
        file_path: filePath,
        metadata: { error: errorMessage },
      });
      
      // Provide more specific error messages
      if (errorMessage.includes('timeout')) {
        throw new Error("Image analysis timed out. Please try again.");
      } else if (errorMessage.includes('Failed to download image')) {
        throw new Error("Failed to download image. Please try a different image.");
      } else {
        throw new Error(`Image analysis failed: ${errorMessage}`);
      }
    }

    const result = await res.json();
    logEvent("image_scan_success", { analysis: result });

    // Log scan success to Supabase
    // @ts-expect-error - image_events table type not generated
    await supabase.from("image_events").insert({
      user_id: userId,
      event_name: "image_scan_success",
      file_path: filePath,
      metadata: { analysis: result },
    });

    return result;
  },

  async processImage(file: File, userId: string) {
    const uploadResult = await this.uploadImage(file, userId);
    const analysis = await this.scanImage(uploadResult.filePath, userId);
    return { ...uploadResult, analysis };
  },

  // Helper function to log upgrade prompts
  async logUpgradePrompt(userId: string, feature: string, tier: string) {
    try {
      logEvent("upgrade_prompt_shown", { feature, tier });

      // @ts-expect-error - image_events table type not generated
      await supabase.from("image_events").insert({
        user_id: userId,
        event_name: "upgrade_prompt_shown",
        metadata: { feature, tier },
      });
    } catch (err) {
      logger.error('[ImageService] Error logging feature attempt:', err);
    }
  },

  // File validation helpers
  isFormatSupported(mimeType: string): boolean {
    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    return supportedFormats.includes(mimeType);
  },

  getSupportedFormats(): string[] {
    return ['JPEG', 'PNG', 'GIF', 'WebP', 'HEIC', 'HEIF'];
  },

  getMaxFileSize(): number {
    return 10 * 1024 * 1024; // 10MB
  },

  // Future-proofing: Easy to add new AI providers
  async analyzeWithProvider(imageUrl: string, userId: string, provider: 'claude' | 'openai' | 'google' = 'claude', prompt?: string) {
    const analysisPrompts = {
      claude: prompt || "Analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand.",
      openai: prompt || "Describe this image in detail, focusing on the main subjects, setting, colors, and any text or important visual elements.",
      google: prompt || "Analyze this image and describe what you see, including objects, people, text, colors, and the overall scene."
    };

    // For now, all providers use the same endpoint
    // Future: Add provider-specific routing
    return this.scanImage(imageUrl, userId, analysisPrompts[provider]);
  },

  // Future-proofing: Batch image processing
  async processBatchImages(files: File[], userId: string) {
    const results = await Promise.allSettled(
      files.map(file => this.processImage(file, userId))
    );
    
    return results.map((result, index) => ({
      file: files[index].name,
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  },
};