import { supabase } from "../lib/supabaseClient";
import { useMessageStore } from "../stores/useMessageStore";
import type { Message } from "../types/chat";
import { audioService } from "./audioService";
import { getUserTier } from "./subscriptionService";

export const chatService = {
  sendMessage: async (text: string, onComplete?: () => void) => {
    console.log("[FLOW] sendMessage called with text:", text);
    const { addMessage } = useMessageStore.getState();

    // Add user message
    addMessage({ 
      id: crypto.randomUUID(), 
      role: "user", 
      content: text,
      timestamp: new Date().toISOString()
    });

    // Don't create placeholder assistant message - let ChatPage handle typing indicator
    const assistantId = crypto.randomUUID();

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
      // Create error message
      addMessage({
        id: assistantId,
        role: "assistant",
        content: `Error: ${errorData.error || 'Failed to get response'}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const data = await response.json();
    
    if (!data.success) {
      // Create error message
      addMessage({
        id: assistantId,
        role: "assistant",
        content: `Error: ${data.message || 'Failed to get response'}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Create assistant message with the actual response
    const responseText = data.response;
    addMessage({
      id: assistantId,
      role: "assistant",
      content: responseText,
      timestamp: new Date().toISOString()
    });

    // 🔊 Play TTS if tier allows
    if (currentTier !== "free" && typeof audioService.play === "function") {
      audioService.play(responseText);
    }

    // Call completion callback to clear typing indicator
    onComplete?.();
  },

  handleFileMessage: async (message: Message, onComplete?: () => void) => {
    try {
      console.log("[FLOW] handleFileMessage called:", { type: message.type, content: message.content });
      const { addMessage, updateMessage, messages } = useMessageStore.getState();

      // Check if this message already exists (for updates)
      const existingMessage = messages.find(m => m.id === message.id);
      
      if (existingMessage) {
        // Update existing message
        console.log("[FLOW] Updating existing message:", message.id);
        updateMessage(message.id, message);
      } else {
        // Add new message
        console.log("[FLOW] Adding new message:", message.id);
        addMessage(message);
      }
      
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
            // Add Atlas's response about the attachments
            addMessage({
              id: crypto.randomUUID(),
              role: "assistant",
              content: data.response,
              timestamp: new Date().toISOString()
            });
          }
        } else {
          console.error("Failed to analyze attachments:", response.status);
        }
      }
      // Legacy: Handle single image messages
      else if (message.type === 'image') {
        // Get the image URL - check content (string) or metadata.imageUrl
        const imageUrl = message.metadata?.imageUrl || 
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
              // Add Atlas's response about the image
              addMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                content: data.response,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            const errorText = await response.text();
            console.error("Failed to analyze image:", response.status, errorText);
            // Add error message
            addMessage({
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Sorry, I couldn't analyze that image. Please try again.",
              timestamp: new Date().toISOString()
            });
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