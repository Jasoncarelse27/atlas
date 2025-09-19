import { createClient } from "@supabase/supabase-js";
import { authApi } from "../utils/authFetch";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SendMessagePayload {
  message: string;
  conversationId: string;
  tier?: string; // Optional, will default to 'free' if not provided
  onMessage: (partial: string) => void;
  onComplete?: (full: string) => void;
  onError?: (error: string) => void;
}

export const sendMessageToBackend = async ({
  message,
  conversationId,
  tier = 'free',
  onMessage,
  onComplete,
  onError,
}: SendMessagePayload) => {
  try {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    
    // Debug log in development
    if (import.meta.env.DEV) {
      console.log(`Sending message with tier: ${tier}`);
    }
    
    // Use authApi.post for automatic token handling and error management
    const data = await authApi.post(
      `${API_URL}/message`,
      { message, conversationId, tier }
    );

    const fullMessage = data.message || "Hello! I'm Atlas, your AI assistant. How can I help you today?";
    
    // Simulate streaming by sending the message in chunks
    const words = fullMessage.split(' ');
    let currentMessage = '';
    
    for (let i = 0; i < words.length; i++) {
      currentMessage += words[i] + ' ';
      onMessage(words[i] + ' ');
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for streaming effect
    }

    onComplete?.(fullMessage);
    return fullMessage;
  } catch (error: any) {
    const message = error?.message || "Unknown error";
    onError?.(message);
    throw new Error(message);
  }
};

export const getSupabaseUserTier = async (userId: string) => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .single();

  if (error) {
    console.warn('Could not get user tier, defaulting to free:', error.message);
    return 'free';
  }
  return data.subscription_tier || 'free';
};
