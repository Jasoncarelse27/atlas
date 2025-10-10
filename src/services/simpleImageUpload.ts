// Simple Image Upload Service - No Over-Engineering
import { supabase } from '../lib/supabaseClient';

export interface SimpleUploadResult {
  url: string;
  filePath: string;
  success: boolean;
}

export const simpleImageUpload = {
  async upload(file: File, userId: string): Promise<SimpleUploadResult> {
    try {
      console.log('📤 Simple image upload starting:', file.name);
      
      // Generate simple file path
      const timestamp = Date.now();
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `img_${timestamp}.${extension}`;
      const filePath = `${userId}/${fileName}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });
      
      if (error) {
        console.error('❌ Upload failed:', error);
        throw error;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);
      
      console.log('✅ Simple upload successful:', urlData.publicUrl);
      
      return {
        url: urlData.publicUrl,
        filePath: data.path,
        success: true
      };
    } catch (error) {
      console.error('❌ Simple upload error:', error);
      throw error;
    }
  }
};
