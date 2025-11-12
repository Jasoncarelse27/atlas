import { logger } from '../lib/logger';
import { supabase } from "../lib/supabaseClient";
import { getApiEndpoint } from '../utils/apiClient';
import { validateFile, getFileTypeCategory, getFileTypeName } from '../utils/fileValidation';

// Event logging helper
const logEvent = (eventName: string, props: Record<string, unknown>) => {
  if (process.env.NODE_ENV !== "production") {
    // Log events in development
  }
};

export const fileService = {
  /**
   * Upload a file to Supabase storage
   * 
   * @param file - File to upload
   * @param userId - User ID
   * @returns Upload result with file path and public URL
   */
  async uploadFile(file: File, userId: string) {
    try {
      // ✅ TIER ENFORCEMENT: Check if user has file access (Core/Studio only)
      // Defense-in-depth: Even though UI checks tier, validate here to prevent direct service calls
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      
      const tier = (profile as any)?.subscription_tier || 'free';
      
      if (tier === 'free') {
        logger.warn(`[FileService] Access denied for free tier user: ${userId}`);
        throw new Error('File upload requires Core or Studio tier. Please upgrade to continue.');
      }
      
      logEvent("file_upload_start", { fileName: file.name, size: file.size, type: file.type });

      // ✅ VALIDATE FILE BEFORE UPLOAD
      const validation = await validateFile(file);
      if (!validation.valid) {
        logger.error('[FileService] Validation failed:', validation.error);
        throw new Error(validation.error);
      }

      // Determine file category for size limits
      const category = getFileTypeCategory(file);
      const maxSizeMB = category === 'document' ? 20 : category === 'audio' ? 50 : 100;

      // Log upload start to Supabase
      // @ts-expect-error - file_events table type not generated
      await supabase.from("file_events").insert({
        user_id: userId,
        event_name: "file_upload_start",
        metadata: { 
          name: file.name, 
          size: file.size,
          type: file.type,
          category: category
        },
      }).catch(() => {
        // Table might not exist yet, continue anyway
      });

      const filePath = `${userId}/${Date.now()}-${file.name}`;

      // Upload file to Supabase storage
      const uploadResult = await supabase.storage
        .from("attachments")
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadResult.error) {
        logEvent("file_upload_fail", { error: uploadResult.error.message });
        // @ts-expect-error - file_events table type not generated
        await supabase.from("file_events").insert({
          user_id: userId,
          event_name: "file_upload_fail",
          metadata: { error: uploadResult.error.message },
        }).catch(() => {});
        throw uploadResult.error;
      }

      logEvent("file_upload_complete", { filePath, size: file.size });

      // Log upload success to Supabase
      // @ts-expect-error - file_events table type not generated
      await supabase.from("file_events").insert({
        user_id: userId,
        event_name: "file_upload_complete",
        file_path: filePath,
        file_size: file.size,
        metadata: { 
          name: file.name,
          type: file.type,
          category: category
        },
      }).catch(() => {});

      const publicUrl = this.getPublicUrl(filePath);

      return { 
        filePath, 
        publicUrl, 
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
        category: category
      };
    } catch (error) {
      logger.error('[FileService] Upload failed:', error);
      throw error;
    }
  },

  /**
   * Get public URL for a file path
   */
  getPublicUrl(path: string) {
    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Analyze a file using AI
   * 
   * @param filePath - Path to file in storage
   * @param userId - User ID
   * @param prompt - Optional prompt for analysis
   * @returns Analysis result
   */
  async analyzeFile(filePath: string, userId: string, prompt?: string) {
    logEvent("file_analysis_request", { filePath });

    // Log analysis request to Supabase
    // @ts-expect-error - file_events table type not generated
    await supabase.from("file_events").insert({
      user_id: userId,
      event_name: "file_analysis_request",
      file_path: filePath,
      metadata: { model: "claude-3-haiku-20240307" },
    }).catch(() => {});

    // Get the public URL for the file
    const fileUrl = this.getPublicUrl(filePath);

    // ✅ BEST PRACTICE: Use centralized auth helper
    const { getAuthTokenOrThrow } = await import('../utils/getAuthToken');
    const token = await getAuthTokenOrThrow('You must be logged in to analyze files. Please sign in and try again.');
    
    // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
    const res = await fetch(getApiEndpoint('/api/file-analysis'), {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ 
        fileUrl, 
        userId, 
        prompt: prompt || "Analyze this file and provide detailed insights about its content."
      }),
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = errorData.details || errorData.error || "File analysis failed";
      
      // ✅ Handle tier gating (403 with upgradeRequired)
      if (res.status === 403 && errorData.upgradeRequired) {
        logger.debug('[FileService] File analysis requires upgrade');
        throw new Error(errorData.message || 'File analysis requires Core or Studio tier');
      }
      
      // ✅ Silent fail for service configuration issues - don't spam console
      const isServiceConfigError = errorMessage.includes('Service configuration issue') || 
                                   errorMessage.includes('not configured') ||
                                   res.status === 500 && errorMessage.includes('File analysis failed after 3 attempts');
      
      if (isServiceConfigError) {
        logger.debug('[FileService] Service not configured - silently failing');
        throw new Error('FILE_SERVICE_UNAVAILABLE'); // Special error code for silent handling
      }
      
      logEvent("file_analysis_fail", { error: errorMessage });
      // @ts-expect-error - file_events table type not generated
      await supabase.from("file_events").insert({
        user_id: userId,
        event_name: "file_analysis_fail",
        file_path: filePath,
        metadata: { error: errorMessage },
      }).catch(() => {});
      
      // Provide more specific error messages
      if (errorMessage.includes('timeout')) {
        throw new Error("File analysis timed out. Please try again.");
      } else if (errorMessage.includes('Failed to download file')) {
        throw new Error("Failed to download file. Please try a different file.");
      } else {
        throw new Error(`File analysis failed: ${errorMessage}`);
      }
    }

    const result = await res.json();
    logEvent("file_analysis_success", { analysis: result });

    // Log analysis success to Supabase
    // @ts-expect-error - file_events table type not generated
    await supabase.from("file_events").insert({
      user_id: userId,
      event_name: "file_analysis_success",
      file_path: filePath,
      metadata: { analysis: result },
    }).catch(() => {});

    return result;
  },

  /**
   * Process file: upload and analyze
   */
  async processFile(file: File, userId: string) {
    const uploadResult = await this.uploadFile(file, userId);
    const analysis = await this.analyzeFile(uploadResult.filePath, userId);
    return { ...uploadResult, analysis };
  },

  /**
   * Get file type display name
   */
  getFileTypeName(file: File): string {
    return getFileTypeName(file);
  },

  /**
   * Get file type category
   */
  getFileTypeCategory(file: File): 'document' | 'audio' | 'video' | 'image' | 'unknown' {
    return getFileTypeCategory(file);
  },
};

