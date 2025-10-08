import { supabase } from "../lib/supabaseClient";

// Debug logging helper
const logEvent = (eventName: string, props: any) => {
  if (process.env.NODE_ENV !== "production") {
  }
};

export const imageService = {
  async uploadImage(file: File, userId: string) {
    try {
      logEvent("image_upload_start", { fileName: file.name, size: file.size, type: file.type });

      // Log upload start to Supabase
      await supabase.from("image_events").insert({
        user_id: userId,
        event_name: "image_upload_start",
        metadata: { name: file.name, size: file.size, type: file.type },
      });

      const filePath = `${userId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (error) {
        logEvent("image_upload_fail", { error: error.message });
        await supabase.from("image_events").insert({
          user_id: userId,
          event_name: "image_upload_fail",
          metadata: { error: error.message },
        });
        throw error;
      }

      logEvent("image_upload_complete", { filePath, size: file.size });

      // Log upload success to Supabase
      await supabase.from("image_events").insert({
        user_id: userId,
        event_name: "image_upload_complete",
        file_path: filePath,
        file_size: file.size,
        metadata: { size: file.size, type: file.type },
      });

      const publicUrl = this.getPublicUrl(filePath);
      return { filePath, publicUrl, url: publicUrl };
    } catch (err) {
      throw err;
    }
  },

  getPublicUrl(path: string) {
    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    return data.publicUrl;
  },

  async scanImage(filePath: string, userId: string, prompt?: string) {
    try {
      logEvent("image_scan_request", { filePath });

      // Log scan request to Supabase
      await supabase.from("image_events").insert({
        user_id: userId,
        event_name: "image_scan_request",
        file_path: filePath,
        metadata: { model: "claude-3-5-sonnet-20241022" },
      });

      // Get the public URL for the image
      const imageUrl = this.getPublicUrl(filePath);

      // Call our backend image analysis endpoint
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/image-analysis`, {
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
      await supabase.from("image_events").insert({
        user_id: userId,
        event_name: "image_scan_success",
        file_path: filePath,
        metadata: { analysis: result },
      });

      return result;
    } catch (err) {
      throw err;
    }
  },

  async processImage(file: File, userId: string) {
    try {
      const uploadResult = await this.uploadImage(file, userId);
      const analysis = await this.scanImage(uploadResult.filePath, userId);
      return { ...uploadResult, analysis };
    } catch (err) {
      throw err;
    }
  },

  // Helper function to log upgrade prompts
  async logUpgradePrompt(userId: string, feature: string, tier: string) {
    try {
      logEvent("upgrade_prompt_shown", { feature, tier });

      await supabase.from("image_events").insert({
        user_id: userId,
        event_name: "upgrade_prompt_shown",
        metadata: { feature, tier },
      });
    } catch (err) {
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