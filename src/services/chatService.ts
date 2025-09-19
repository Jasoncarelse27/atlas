import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SendMessagePayload {
  message: string;
  conversationId: string;
  accessToken: string;
  tier?: string; // Optional, will default to 'free' if not provided
  onMessage: (partial: string) => void;
  onComplete?: (full: string) => void;
  onError?: (error: string) => void;
}

export const sendMessageToBackend = async ({
  message,
  conversationId,
  accessToken,
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
    
    const response = await fetch(
      `${API_URL}/message`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, conversationId, tier }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Unknown error");
    }

    const data = await response.json();
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
