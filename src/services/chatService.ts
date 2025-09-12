import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SendMessagePayload {
  message: string;
  conversationId: string;
  accessToken: string;
  onMessage: (partial: string) => void;
  onComplete?: (full: string) => void;
  onError?: (error: string) => void;
}

export const sendMessageToSupabase = async ({
  message,
  conversationId,
  accessToken,
  onMessage,
  onComplete,
  onError,
}: SendMessagePayload) => {
  try {
    const response = await fetch(
      `https://rbwabemtucdkytvvpzvk.functions.supabase.co/messages?stream=1`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, conversationId }),
      }
    );

    if (!response.ok || !response.body) {
      const data = await response.json();
      throw new Error(data.message || "Unknown error");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullMessage = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullMessage += chunk;
      onMessage(chunk);
    }

    onComplete?.(fullMessage);
    return fullMessage;
  } catch (_error: unknown) {
    const message = error?.message || "Unknown error";
    onError?.(message);
    throw new Error(message);
  }
};

export const getSupabaseUserTier = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data.subscription_tier;
};
