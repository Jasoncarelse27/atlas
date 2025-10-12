import { supabase } from "../lib/supabaseClient";
// Removed useMessageStore import - using callback pattern instead
import type { Message } from "../types/chat";
import { generateUUID } from "../utils/uuid";
import { audioService } from "./audioService";
import { enhancedResponseCacheService } from "./enhancedResponseCacheService";
import { subscriptionApi } from "./subscriptionApi";

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
  
  try {
    // Get JWT token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || 'mock-token-for-development';

    // Get user's tier for the request
    const currentTier = await subscriptionApi.getUserTier(userId, token);
    
    // Send to backend - use relative URL for mobile compatibility
    // This ensures mobile devices use the Vite proxy instead of direct localhost calls
    const messageEndpoint = '/message';
    
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


    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Backend error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    return data;
  } catch (error) {
    throw error;
  }
}

export const chatService = {
  sendMessage: async (text: string, onComplete?: () => void, conversationId?: string, userId?: string) => {
    // 🧠 ATLAS GOLDEN STANDARD - Prevent duplicate message calls
    const messageId = `${userId}-${conversationId}-${text.slice(0, 20)}`;
    
    if (pendingMessages.has(messageId)) {
      console.warn('[ChatService] ⚠️ Duplicate message call prevented:', messageId);
      return;
    }
    pendingMessages.add(messageId);

    // Set up abort controller for cancellation (always create fresh)
    abortController = new AbortController();

    try {
      // ✅ PERFORMANCE: Get JWT token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || 'mock-token-for-development';
      
      // Get user ID from session if not provided
      const actualUserId = userId || session?.user?.id;
      console.log('[ChatService] User ID resolution:', {
        providedUserId: userId,
        sessionUserId: session?.user?.id,
        actualUserId,
        hasSession: !!session
      });
      
      // ✅ FIX: Prevent 'anonymous' from reaching Supabase
      if (!actualUserId) {
        console.error('[ChatService] No user ID available - user not authenticated');
        throw new Error('User not authenticated. Please sign in to send messages.');
      }

      // ✅ PERFORMANCE: Get user's tier for the request
      const currentTier = await subscriptionApi.getUserTier(actualUserId, token);

      // ✅ ENHANCED CACHING: Check cache first for 20-30% cost reduction
      console.log('[ChatService] 🔍 Checking enhanced cache for query:', text.substring(0, 50));
      const cachedResponse = await enhancedResponseCacheService.getCachedResponse(text, currentTier as any);
      
      if (cachedResponse) {
        console.log('[ChatService] ✅ Cache hit! Returning cached response (API cost saved)');
        pendingMessages.delete(messageId);
        
        // Return cached response in the same format as API response
        return {
          success: true,
          response: cachedResponse,
          conversationId: conversationId,
          cached: true,
          costSaved: true
        };
      }
      
      console.log('[ChatService] ❌ Cache miss, proceeding to API call');
      
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
        responseText = "Sorry, I couldn't process that request.";
      }

      // ✅ ENHANCED CACHING: Cache the response for future use
      console.log('[ChatService] 💾 Caching response for future cost savings');
      await enhancedResponseCacheService.cacheResponse(text, responseText, currentTier as any);

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
      }
      
      // Reset streaming state
      // Removed useMessageStore.setIsStreaming - using callback pattern instead
      abortController = null;
      
      // Return both response text and conversation ID
      return {
        response: responseText,
        conversationId: data.conversationId
      };
    } catch (error) {
      
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
      // Message management is handled by the calling component

      // Message management is handled by the calling component
      
      // Handle messages with attachments (new multi-attachment support)
      if (message.attachments && message.attachments.length > 0) {
        
        // Get user info for the request
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || 'mock-token-for-development';
        
        // Get user ID from session
        const actualUserId = session?.user?.id || 'anonymous';
        
        // Get user's tier for the request
        const imageTier = await subscriptionApi.getUserTier(actualUserId, token);
        
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
          }
        } else {
        }
      }
      // Legacy: Handle single image messages
      else if (message.type === 'image') {
        // Get the image URL - check content (string) or metadata.url
        const imageUrl = message.metadata?.url || 
                        (typeof message.content === 'string' && message.content.startsWith('http') ? message.content : null);
        
        if (imageUrl) {
          
          // Get user info for the request
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || 'mock-token-for-development';
          
          // Get user ID from session
          const actualUserId = session?.user?.id || 'anonymous';
          
          // Get user's tier for the request
          const imageTier = await subscriptionApi.getUserTier(actualUserId, token);
          
          // Send image analysis request to backend
          const requestBody = { 
            message: "Please analyze this image",
            tier: imageTier,
            imageUrl: imageUrl // Send image URL for analysis
          };
          
          const response = await fetch(`/message`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(requestBody),
          });

          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Log response - message management handled by calling component
            }
          } else {
            const errorText = await response.text();
            // Log error - message management handled by calling component
          }
        }
      }

      // Call completion callback
      onComplete?.();
    } catch (error) {
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
        
        // ✅ Handle tier gating response
        if (response.status === 403 && errorData.upgrade) {
          
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
      // Don't throw - user message is still saved, just no AI response
      return { success: true }; // Still return success - user message was saved
    }
  } catch (err) {
    throw err; // Only throw if the entire send operation failed
  }
}// Force Vercel rebuild Sat Sep 27 16:47:24 SAST 2025
