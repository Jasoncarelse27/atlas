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
    const response = await fetch("http://localhost:3000/message", {
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
      
      // If it's an image, send it to Atlas for analysis
      if (message.type === 'image') {
        // Get the image URL(s) - could be in url field or content array
        const imageUrls = message.url ? [message.url] : 
                         (Array.isArray(message.content) ? message.content : []);
        
        if (imageUrls.length > 0) {
          // Get user info for the request
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || 'mock-token-for-development';
          
          // Get user's tier for the request
          const imageTier = await getUserTier();
          
          // Send image analysis request to backend
          const response = await fetch("http://localhost:3000/message", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ 
              message: "Please analyze this image",
              tier: imageTier,
              imageUrl: imageUrls[0] // Send first image for analysis
            }),
          });

          if (response.ok) {
            const data = await response.json();
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