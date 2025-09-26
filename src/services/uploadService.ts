import { supabase } from "@/lib/supabase";
import { useMessageStore } from "@/stores/useMessageStore";

export async function uploadWithAuth(file: File, feature: string, userId: string) {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("No auth token");

  const form = new FormData();
  form.append("file", file);
  form.append("feature", feature);
  form.append("userId", userId);

  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const res = await fetch(`${backendUrl}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Upload failed: ${res.status} ${errorText}`);
  }
  
  return res.json(); // {url}
}

// Enhanced image upload with progress tracking
export async function uploadImageWithProgress(
  file: File, 
  messageId: string, 
  callbacks: {
    onProgress?: (progress: number) => void;
    onSuccess?: (publicUrl: string) => void;
    onError?: (error: Error) => void;
  }
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const executeUpload = async () => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        callbacks.onProgress?.(percent);
      }
    };

    xhr.onload = async () => {
      if (xhr.status !== 200) {
        const error = new Error("Upload failed");
        callbacks.onError?.(error);
        reject(error);
        return;
      }

      try {
        const response = JSON.parse(xhr.responseText);
        console.log('[DEBUG] UploadService - Backend response:', response);
        console.log('[DEBUG] UploadService - Public URL from backend:', response.url);
        
        if (response.url) {
          // Fix the URL by replacing problematic characters in the filename
          // This handles cases where the backend ignores our sanitized filename
          const sanitizedUrl = response.url
            .replace(/\(/g, '')           // Remove opening parentheses
            .replace(/\)/g, '')           // Remove closing parentheses  
            .replace(/%20/g, '_')         // Replace URL-encoded spaces with underscores
            .replace(/\s+/g, '_');       // Replace any remaining spaces with underscores
          
          console.log('[DEBUG] UploadService - Fixed URL:', sanitizedUrl);
          
          callbacks.onSuccess?.(sanitizedUrl);
          resolve();
        } else {
          throw new Error("No URL returned from upload");
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        callbacks.onError?.(err);
        reject(err);
      }
    };

    xhr.onerror = () => {
      const error = new Error("Upload failed");
      callbacks.onError?.(error);
      reject(error);
    };
    
    // Use the backend upload endpoint for progress tracking
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    xhr.open("POST", `${backendUrl}/api/upload`);
    // Get the session token properly
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      const error = new Error("No authentication token");
      callbacks.onError?.(error);
      reject(error);
      return;
    }
    
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    
    // Create FormData for the upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('feature', 'image');
    formData.append('messageId', messageId);
    
    // Sanitize filename to prevent 400 errors
    const sanitizeFileName = (fileName: string): string => {
      return fileName
        .replace(/\s+/g, "_")         // replace spaces with underscores
        .replace(/[()]/g, "")         // remove parentheses
        .replace(/[^a-zA-Z0-9._-]/g, ""); // remove other unsafe chars
    };
    
    const safeFileName = sanitizeFileName(file.name);
    formData.append('safeFileName', safeFileName);
    
    console.log('[DEBUG] UploadService - Original filename:', file.name);
    console.log('[DEBUG] UploadService - Sanitized filename:', safeFileName);
    console.log('[DEBUG] UploadService - Sending safeFileName to backend:', safeFileName);
    
    xhr.send(formData);
    };
    
    executeUpload().catch(reject);
  });
}

// Legacy function for backward compatibility
export async function uploadImage(messageId: string, file: File): Promise<void> {
  return uploadImageWithProgress(file, messageId, {
    onProgress: (progress) => {
      useMessageStore.getState().updateMessage(messageId, { progress });
    },
    onSuccess: async (publicUrl) => {
      useMessageStore.getState().updateMessage(messageId, {
        content: publicUrl,
        status: "done",
        uploading: false,
        progress: 100
      });
      
      // Trigger AI analysis of the image
      try {
        const { chatService } = await import('./chatService');
        await chatService.sendMessage({
          type: "image",
          content: publicUrl,
          role: "user"
        });
        console.log('[DEBUG] AI analysis triggered for image:', publicUrl);
      } catch (error) {
        console.error('[ERROR] Failed to trigger AI analysis:', error);
      }
    },
    onError: (error) => {
      useMessageStore.getState().updateMessage(messageId, {
        status: "error",
        uploading: false
      });
    }
  });
}

// Retry pending uploads from Dexie (offline persistence)
export async function retryPendingUploads(): Promise<void> {
  try {
    // This would be implemented with Dexie integration
    // For now, just log that we would retry
    console.log('[UPLOAD] Retrying pending uploads...');
  } catch (error) {
    console.error('[UPLOAD] Failed to retry pending uploads:', error);
  }
}
