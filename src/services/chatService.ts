import { supabase } from "../lib/supabaseClient";
import { useMessageStore } from "../stores/useMessageStore";
import type { Message } from "../types/chat";
import { audioService } from "./audioService";
import { getUserTier } from "./subscriptionService";

// Global abort controller for message streaming
let abortController: AbortController | null = null;

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
    
    // Send to backend
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    console.log(`[chatService] Sending attachments to backend: ${backendUrl}/message`);
    
    const response = await fetch(`${backendUrl}/message`, {
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
    // Chat flow - only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log("[FLOW] sendMessage called with text:", text, "conversationId:", conversationId);
    }

    // Set up abort controller for cancellation (always create fresh)
    abortController = new AbortController();
    useMessageStore.getState().setIsStreaming(true);
    
    // Debug log to verify abortController is created
    if (process.env.NODE_ENV === 'development') {
      console.log("[FLOW] AbortController created:", !!abortController, "signal:", !!abortController?.signal);
    }

    try {
      // Get JWT token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || 'mock-token-for-development';

      // Get user's tier for the request
      const currentTier = await getUserTier();
      
      // Memory extraction is handled by the component layer
      // This keeps the service layer clean and avoids circular dependencies

      // Get response from backend (JSON response, not streaming)
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FLOW] Sending to backend: ${backendUrl}/message`);
      }
      
      const response = await fetch(`${backendUrl}/message`, {
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

      console.log(`[FLOW] Backend response status: ${response.status}`);

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
      console.log('Backend response data:', data);
      
      // Handle different response formats
      let responseText;
      if (data.reply) {
        responseText = data.reply;
        console.log('✅ Using data.reply:', responseText);
      } else if (data.response) {
        responseText = data.response;
        console.log('✅ Using data.response:', responseText);
      } else if (typeof data === 'string') {
        responseText = data;
        console.log('✅ Using data as string:', responseText);
      } else {
        console.error('❌ Unexpected response format:', data);
        responseText = "Sorry, I couldn't process that request.";
      }

      console.log('✅ Final response text:', responseText);

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
          console.log('🔄 [chatService] Profile refreshed after message sent');
        }
      } catch (refreshError) {
        console.warn('⚠️ [chatService] Failed to refresh profile:', refreshError);
      }
      
      // Reset streaming state
      useMessageStore.getState().setIsStreaming(false);
      abortController = null;
      
      return responseText;
    } catch (error) {
      console.error('[FLOW] Error in sendMessage:', error);
      
      // Reset streaming state on error
      useMessageStore.getState().setIsStreaming(false);
      abortController = null;
      onComplete?.();
      throw error;
    }
  },
  
  // Stop streaming function
  stopMessageStream: () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    useMessageStore.getState().setIsStreaming(false);
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
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/message`, {
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
            url: `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/message`,
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: requestBody
          });
          
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/message`, {
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
  useMessageStore.getState().setIsStreaming(false);
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

  const tempId = crypto.randomUUID();

  // ✅ Single message with all attachments and one caption
  const newMessage = {
    id: tempId,
    conversationId,
    role: "user",
    type: "attachment", // ✅ mark as attachment type
    content: caption || "", // ✅ single caption as content
    attachments, // ✅ all attachments grouped together
    status: "pending",
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

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/image-analysis`, {
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
            id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
          conversationId,
          role: "assistant",
          content: data.analysis,
          createdAt: new Date().toISOString(),
        };
        
        addMessage(aiMessage);
        
        // ✅ Backend already saved the analysis to database
      }
    } catch (aiError) {
      console.error("[chatService] ❌ AI analysis failed:", aiError);
      // Don't throw - user message is still saved
    }
  } catch (err) {
    console.error("[chatService] ❌ Failed to send message:", err);
    // Optionally mark message as failed in store
  }
}// Force Vercel rebuild Sat Sep 27 16:47:24 SAST 2025
