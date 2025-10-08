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
      title: "Default Conversation",
    });

    if (error) {
    }
  }

  return conversationId;
}
