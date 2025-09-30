import { supabase } from "../lib/supabaseClient";

// Debug logging helper
const logEvent = (eventName: string, props: any) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ImageEvent] ${eventName}`, props);
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
      const { data, error } = await supabase.storage
        .from("images")
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
      console.error("Image upload error:", err);
      throw err;
    }
  },

  getPublicUrl(path: string) {
    const { data } = supabase.storage.from("images").getPublicUrl(path);
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
        logEvent("image_scan_fail", { error: errorData.details || "API call failed" });
        await supabase.from("image_events").insert({
          user_id: userId,
          event_name: "image_scan_fail",
          file_path: filePath,
          metadata: { error: errorData.details || "API call failed" },
        });
        throw new Error(errorData.details || "Image scan failed");
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
      console.error("Image scan error:", err);
      throw err;
    }
  },

  async processImage(file: File, userId: string) {
    try {
      const uploadResult = await this.uploadImage(file, userId);
      const analysis = await this.scanImage(uploadResult.filePath, userId);
      return { ...uploadResult, analysis };
    } catch (err) {
      console.error("Image processing error:", err);
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
      console.error("Failed to log upgrade prompt:", err);
    }
  },

  // File validation helpers
  isFormatSupported(mimeType: string): boolean {
    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return supportedFormats.includes(mimeType);
  },

  getSupportedFormats(): string[] {
    return ['JPEG', 'PNG', 'GIF', 'WebP'];
  },

  getMaxFileSize(): number {
    return 10 * 1024 * 1024; // 10MB
  },
};