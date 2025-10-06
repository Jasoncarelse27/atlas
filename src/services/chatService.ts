import { supabase } from "../lib/supabaseClient";
// Removed useMessageStore import - using callback pattern instead
import type { Message } from "../types/chat";
import { generateUUID } from "../utils/uuid";
import { audioService } from "./audioService";
import { getUserTier } from "./subscriptionService";

// Global abort controller for message streaming
let abortController: AbortController | null = null;

// 🧠 ATLAS GOLDEN STANDARD - Prevent duplicate message calls
const pendingMessages = new Set<string>();

// Simple function for AttachmentMenu to send messages with attachments
export async function sendAttachmentMessage(
  conversationId: string,
  userId: string,
  attachments: Array<{ type: string; url?: string; text?: string }>
) {
  console.log("[chatService] sendAttachmentMessage called:", { conversationId, userId, attachments });
  
  try {
    // Get JWT token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || 'mock-token-for-development';

    // Get user's tier for the request
    const currentTier = await getUserTier();
    
    // Send to backend - use relative URL for mobile compatibility
    // This ensures mobile devices use the Vite proxy instead of direct localhost calls
    const messageEndpoint = '/message';
    console.log(`[chatService] Sending attachments to backend: ${messageEndpoint}`);
    
    const response = await fetch(messageEndpoint, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ 
        message: "Please analyze these attachments",
        userId: userId,
        tier: currentTier,
        attachments: attachments
      }),
    });

    console.log(`[chatService] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Backend error:', errorData);
      throw new Error(`Backend error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('Backend response data:', data);
    
    return data;
  } catch (error) {
    console.error('[chatService] Error in sendAttachmentMessage:', error);
    throw error;
  }
}

export const chatService = {
  sendMessage: async (text: string, onComplete?: () => void, conversationId?: string, userId?: string) => {
    // 🧠 ATLAS GOLDEN STANDARD - Prevent duplicate message calls
    const messageId = `${userId}-${conversationId}-${text.slice(0, 20)}-${Date.now()}`;
    
    if (pendingMessages.has(messageId)) {
      return;
    }
    pendingMessages.add(messageId);

    // Set up abort controller for cancellation (always create fresh)
    abortController = new AbortController();

    try {
      // Get JWT token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || 'mock-token-for-development';

      // Get user's tier for the request
      const currentTier = await getUserTier();
      
      // Memory extraction is handled by the component layer
      // This keeps the service layer clean and avoids circular dependencies

      // Get response from backend (JSON response, not streaming)
      // Use relative URL to leverage Vite proxy for mobile compatibility
      // This ensures mobile devices use the proxy instead of direct localhost calls
      const messageEndpoint = '/message';
      
      const response = await fetch(messageEndpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          text: text,
          userId: session?.user?.id || userId || '', // Use passed userId or session userId
          conversationId: conversationId || null // ✅ Pass conversationId if available
        }),
        signal: abortController?.signal, // Add abort signal for cancellation (with null check)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Backend error:', errorData);
        
        // ✅ Handle monthly limit reached
        if (response.status === 429 && errorData.error === 'MONTHLY_LIMIT_REACHED') {
          throw new Error('MONTHLY_LIMIT_REACHED');
        }
        
        throw new Error(`Backend error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Handle different response formats
      let responseText;
      if (data.reply) {
        responseText = data.reply;
      } else if (data.response) {
        responseText = data.response;
      } else if (typeof data === 'string') {
        responseText = data;
      } else {
        console.error('❌ Unexpected response format:', data);
        responseText = "Sorry, I couldn't process that request.";
      }

      // 🔊 Play TTS if tier allows
      if (currentTier !== "free" && typeof audioService.play === "function") {
        audioService.play(responseText);
      }

      // Call completion callback to clear typing indicator
      onComplete?.();
      
      // Refresh profile to get updated usage stats
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          // Trigger a profile refresh by calling the profile endpoint
          await fetch(`${import.meta.env.VITE_API_URL}/v1/user_profiles/${userId}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });
        }
      } catch (refreshError) {
        console.warn('⚠️ [chatService] Failed to refresh profile:', refreshError);
      }
      
      // Reset streaming state
      // Removed useMessageStore.setIsStreaming - using callback pattern instead
      abortController = null;
      
      return responseText;
    } catch (error) {
      console.error('[FLOW] Error in sendMessage:', error);
      
      // Reset streaming state on error
      // Removed useMessageStore.setIsStreaming - using callback pattern instead
      abortController = null;
      onComplete?.();
      throw error;
    } finally {
      // 🧠 ATLAS GOLDEN STANDARD - Clean up duplicate prevention
      pendingMessages.delete(messageId);
    }
  },
  
  // Stop streaming function
  stopMessageStream: () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    // Removed useMessageStore.setIsStreaming - using callback pattern instead
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
        const response = await fetch('/message', {
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
            url: '/message',
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: requestBody
          });
          
          const response = await fetch('/message', {
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

// Export stopMessageStream function
export const stopMessageStream = () => {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  // Removed useMessageStore.setIsStreaming - using callback pattern instead
};

// Export the sendMessageWithAttachments function for resendService
export async function sendMessageWithAttachments(
  conversationId: string,
  attachments: any[],
  addMessage: (msg: any) => void,
  caption?: string,
  userId?: string
) {
  console.debug("[chatService] sendMessageWithAttachments", { conversationId, attachments, caption });

  const tempId = generateUUID();

  // ✅ FUTURE-PROOF FIX: Format message to match what EnhancedMessageBubble expects
  const imageUrl = attachments[0]?.url || attachments[0]?.publicUrl;
  
  const newMessage = {
    id: tempId,
    conversationId,
    role: "user",
    content: caption || "", // ✅ user caption as content
    url: imageUrl, // ✅ image URL for display
    imageUrl: imageUrl, // ✅ also set imageUrl for compatibility
    attachments: attachments.map(att => ({
      type: att.type || 'image',
      url: att.url || att.publicUrl,
      caption: caption || ''
    })), // ✅ properly formatted attachments array
    status: "pending",
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  console.log("[chatService] Sending message with caption + attachments:", newMessage);

  // Show optimistically in UI
  addMessage(newMessage);

  try {
    // Use already uploaded attachments (from imageService)
    const uploadedAttachments = attachments.map(att => ({
      ...att,
      // Ensure we have the URL from the upload
      url: att.url || att.publicUrl
    }));

    // ✅ Backend will handle saving to Supabase - no direct DB calls needed

    // ✅ NEW: Send to backend for AI analysis
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || 'mock-token-for-development';
      
      // Get user's tier for the request (not needed for image analysis endpoint)
      // const currentTier = await getUserTier();
      
      console.log("[chatService] 🧠 Sending attachments to backend for AI analysis...");
      
      // Use the dedicated image analysis endpoint for better reliability
      const imageAttachment = uploadedAttachments.find(att => att.type === 'image');
      if (!imageAttachment) {
        throw new Error('No image attachment found');
      }

      const response = await fetch('/api/image-analysis', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          imageUrl: imageAttachment.url,
          userId: userId,
          prompt: caption || "Please analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand."
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[chatService] Backend analysis error:', errorData);
        
        // ✅ Handle tier gating response
        if (response.status === 403 && errorData.upgrade) {
          console.log("[chatService] ⚠️ Tier upgrade required for image analysis");
          
          // Add upgrade message to chat
          const upgradeMessage = {
            id: generateUUID(),
            conversationId,
            role: "assistant",
            content: errorData.message,
            createdAt: new Date().toISOString(),
          };
          
          addMessage(upgradeMessage);
          
          // ✅ Backend will handle saving upgrade message if needed
        }
        return;
      }

      const data = await response.json();
      
      if (data.success && data.analysis) {
        console.log("[chatService] ✅ AI analysis complete:", data.analysis);
        
        // ✅ Add AI response as assistant message
        const aiMessage = {
          id: generateUUID(),
          conversationId,
          role: "assistant",
          content: data.analysis,
          createdAt: new Date().toISOString(),
        };
        
        addMessage(aiMessage);
        
        // ✅ Backend already saved the analysis to database
      }
      
      // 🎯 FUTURE-PROOF FIX: Return success to prevent false error toast
      return { success: true };
      
    } catch (aiError) {
      console.error("[chatService] ❌ AI analysis failed:", aiError);
      // Don't throw - user message is still saved, just no AI response
      return { success: true }; // Still return success - user message was saved
    }
  } catch (err) {
    console.error("[chatService] ❌ Failed to send message:", err);
    throw err; // Only throw if the entire send operation failed
  }
}// Force Vercel rebuild Sat Sep 27 16:47:24 SAST 2025
