import { supabase } from "../lib/supabaseClient";
import type { PendingAttachment } from "../stores/useMessageStore";
import type { Message } from "../types/chat";
import { audioService } from "./audioService";
import { getUserTier } from "./subscriptionService";
import { uploadWithAuth } from "./uploadService";

export const chatService = {
  sendMessage: async (text: string, onComplete?: () => void) => {
    console.log("[FLOW] sendMessage called with text:", text);

    // Message management is handled by the calling component

    // Get JWT token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || 'mock-token-for-development';

    // Get user's tier for the request
    const currentTier = await getUserTier();
    
    // Get response from backend (JSON response, not streaming)
    const response = await fetch("http://localhost:8000/message", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ 
        message: text,
        tier: currentTier
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Backend error:', errorData);
      // Log error - message management handled by calling component
      console.error('Backend error:', errorData);
      return;
    }

    const data = await response.json();
    
    if (!data.success) {
      // Log error - message management handled by calling component
      console.error('Backend response error:', data.message || 'Failed to get response');
      return;
    }

    // Return response - message management handled by calling component
    const responseText = data.response;
    console.log('Backend response:', responseText);

    // 🔊 Play TTS if tier allows
    if (currentTier !== "free" && typeof audioService.play === "function") {
      audioService.play(responseText);
    }

    // Call completion callback to clear typing indicator
    onComplete?.();
    
    return responseText;
  },

  handleFileMessage: async (message: Message, onComplete?: () => void) => {
    try {
      console.log("[FLOW] handleFileMessage called:", { type: message.type, content: message.content });
      // Message management is handled by the calling component

      // Message management is handled by the calling component
      
      // Handle messages with attachments (new multi-attachment support)
      if (message.attachments && message.attachments.length > 0) {
        console.log("[FLOW] Sending multi-attachment message for analysis:", message.attachments);
        
        // Get user info for the request
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || 'mock-token-for-development';
        
        // Get user's tier for the request
        const imageTier = await getUserTier();
        
        // Send multi-attachment analysis request to backend
        const response = await fetch("http://localhost:8000/message", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ 
            message: "Please analyze these attachments",
            tier: imageTier,
            attachments: message.attachments // Send attachments array
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Log response - message management handled by calling component
            console.log('Multi-attachment response:', data.response);
          }
        } else {
          console.error("Failed to analyze attachments:", response.status);
        }
      }
      // Legacy: Handle single image messages
      else if (message.type === 'image') {
        // Get the image URL - check content (string) or metadata.url
        const imageUrl = message.metadata?.url || 
                        (typeof message.content === 'string' && message.content.startsWith('http') ? message.content : null);
        
        if (imageUrl) {
          console.log("[FLOW] Sending image for analysis:", imageUrl);
          
          // Get user info for the request
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || 'mock-token-for-development';
          
          // Get user's tier for the request
          const imageTier = await getUserTier();
          
          // Send image analysis request to backend
          const requestBody = { 
            message: "Please analyze this image",
            tier: imageTier,
            imageUrl: imageUrl // Send image URL for analysis
          };
          
          console.log("[DEBUG] Frontend sending request to backend:", {
            url: "http://localhost:8000/message",
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: requestBody
          });
          
          const response = await fetch("http://localhost:8000/message", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(requestBody),
          });

          console.log("[DEBUG] Backend response status:", response.status);
          console.log("[DEBUG] Backend response headers:", Object.fromEntries(response.headers.entries()));
          
          if (response.ok) {
            const data = await response.json();
            console.log("[DEBUG] Backend response data:", data);
            if (data.success) {
              // Log response - message management handled by calling component
              console.log('Image analysis response:', data.response);
            }
          } else {
            const errorText = await response.text();
            console.error("Failed to analyze image:", response.status, errorText);
            // Log error - message management handled by calling component
            console.error("Image analysis failed");
          }
        }
      }

      // Call completion callback
      onComplete?.();
    } catch (error) {
      console.error("[FLOW] Error in handleFileMessage:", error);
      throw error;
    }
  }
};

// Export the sendMessageWithAttachments function for resendService
export async function sendMessageWithAttachments(
  conversationId: string,
  userId: string,
  { text, attachments }: {
    text: string;
    attachments: PendingAttachment[];
  }
) {
  console.debug("[chatService] sendMessageWithAttachments", { conversationId, userId, text, attachments });

  const safeAttachments = (attachments || []).slice(0, 5);

  const content: any[] = [];

  if (text && text.trim().length > 0) {
    content.push({ type: "text", text });
  }

  // Upload attachments and add them to content
  for (const attachment of safeAttachments) {
    try {
      // Upload the file and get the URL
      const uploadResult = await uploadWithAuth(attachment.file, userId, attachment.caption || "");
      
      // Add to content with caption if provided
      const attachmentContent: any = {
        type: "image_url",
        image_url: { url: uploadResult.url },
      };
      
      // Include caption if provided
      if (attachment.caption) {
        attachmentContent.caption = attachment.caption;
      }
      
      content.push(attachmentContent);
    } catch (error) {
      console.error("Failed to upload attachment:", error);
      // Continue with other attachments even if one fails
    }
  }

  const payload = {
    messages: [
      {
        role: "user",
        content: content.length > 0
          ? content
          : [{ type: "text", text: "Please analyze the following images:" }],
      },
    ],
    max_tokens: 1000,
  };

  console.debug("[chatService] Final payload for Anthropic:", payload);

  try {
    const response = await fetch(`http://localhost:8000/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    console.debug("[chatService] ✅ Backend response:", data);
    return data;
  } catch (err) {
    console.error("[chatService] ❌ sendMessageWithAttachments failed:", err);
    throw err;
  }
}// Force Vercel rebuild Sat Sep 27 16:47:24 SAST 2025
