import { v4 as uuidv4 } from 'uuid';
import { supabase } from "../lib/supabaseClient";
import { useMessageStore } from "../stores/useMessageStore";
import { audioService } from "./audioService";
import { fetchWithAuthJSON } from "./fetchWithAuth";

interface SendMessagePayload {
  message: string;
  conversationId: string;
  userId: string; // Required for backend
  tier?: string; // Optional, will default to 'free' if not provided
  onMessage: (partial: string) => void;
  onComplete?: (full: string) => void;
  onError?: (error: string) => void;
}

export const sendMessageToBackend = async ({
  message,
  conversationId,
  userId,
  tier = 'free',
  onMessage,
  onComplete,
  onError,
}: SendMessagePayload) => {
  const { addMessage, updateMessage, setError } = useMessageStore.getState();
  
  // Create user message
  const userMessageId = uuidv4();
  const userMessage = {
    id: userMessageId,
    role: 'user' as const,
    content: message,
    timestamp: new Date().toISOString()
  };
  
  // Add user message to store immediately
  addMessage(userMessage);
  
  // Create placeholder assistant message
  const assistantMessageId = uuidv4();
  const assistantMessage = {
    id: assistantMessageId,
    role: 'assistant' as const,
    content: '',
    streaming: true,
    timestamp: new Date().toISOString()
  };
  
  // Add streaming assistant message to store
  addMessage(assistantMessage);
  
  try {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    
    // Debug log in development
    if (import.meta.env.DEV) {
      console.log(`Sending message with userId: ${userId}, tier: ${tier}`);
    }
    
    // Use fetchWithAuthJSON for automatic token handling and error management
    const data = await fetchWithAuthJSON(
      `${API_URL}/message`,
      {
        method: 'POST',
        body: JSON.stringify({ message, userId, tier })
      }
    );

    const fullMessage = data.response || "Hello! I'm Atlas, your AI assistant. How can I help you today?";
    
    // Simulate streaming by sending the message in chunks
    const words = fullMessage.split(' ');
    let currentMessage = '';
    
    for (let i = 0; i < words.length; i++) {
      currentMessage += words[i] + ' ';
      
      // Update the assistant message in the store
      updateMessage(assistantMessageId, { 
        content: currentMessage.trim(),
        streaming: true 
      });
      
      // Call the callback for backward compatibility
      onMessage?.(words[i] + ' ');
      
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for streaming effect
    }

    // Mark streaming as complete
    updateMessage(assistantMessageId, { 
      content: fullMessage,
      streaming: false 
    });

    // Play TTS for Core/Studio users
    if (tier !== 'free' && fullMessage) {
      try {
        await audioService.playTTS(fullMessage, {
          user_id: userId,
          tier: tier as "core" | "studio",
          session_id: conversationId,
        });
      } catch (ttsError) {
        console.warn("TTS playback failed:", ttsError);
        // Don't fail the entire message if TTS fails
      }
    }

    onComplete?.(fullMessage);
    return fullMessage;
  } catch (error: any) {
    console.error("Chat service error:", error);
    const errorMessage = error?.message || "Unknown error";
    
    // Only show fallback for actual connection failures, not API errors
    if (
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ERR_NETWORK") ||
      errorMessage.includes("ERR_INTERNET_DISCONNECTED")
    ) {
      // Real network/connection error - show fallback
      setError(assistantMessageId, "I'm experiencing some technical difficulties right now. Please try again in a moment.");
    } else {
      // API error or other issue - show the actual error for debugging
      setError(assistantMessageId, `Error: ${errorMessage}`);
    }
    
    onError?.(errorMessage);
    throw new Error(errorMessage);
  }
};

export const getSupabaseUserTier = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .single();

  if (error) {
    console.warn('Could not get user tier, defaulting to free:', error.message);
    return 'free';
  }
  return data.subscription_tier || 'free';
};
