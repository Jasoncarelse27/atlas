import { v4 as uuidv4 } from "uuid";
import { supabase } from "../lib/supabaseClient";

const DEFAULT_CONVERSATION_KEY = "atlas-default-conversation";

export async function getOrCreateDefaultConversation(userId: string) {
  let conversationId = localStorage.getItem(DEFAULT_CONVERSATION_KEY);

  if (!conversationId) {
    conversationId = uuidv4();
    localStorage.setItem(DEFAULT_CONVERSATION_KEY, conversationId);

    // Create conversation in Supabase if not exists
    const { error } = await supabase.from("conversations").insert({
      id: conversationId,
      user_id: userId,
      title: "Default Conversation",
    });

    if (error) {
      console.error("[useConversations] Failed to create conversation:", error);
    }
  }

  return conversationId;
}
