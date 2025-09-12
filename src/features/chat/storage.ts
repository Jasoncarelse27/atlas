// src/features/chat/storage.ts
import { supabase } from "@/lib/supabase";
import { type Message } from "@/stores/useMessageStore";

// ✅ Save a single message to Supabase
export async function saveMessage(message: Message) {
  // Convert store format to Supabase format
  const supabaseMessage = {
    id: message.id,
    type: message.type,
    content: message.content,
    sender: message.sender,
    created_at: message.created_at,
  };

  const { data, error } = await supabase
    .from("messages")
    .insert([supabaseMessage]);

  if (error) throw error;
  return data;
}

// ✅ Load all messages from Supabase
export async function loadMessages(): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  
  // Convert Supabase format to store format
  return (data || []).map((_msg: unknown) => ({
    id: msg.id,
    type: msg.type || 'TEXT',
    content: msg.content,
    sender: msg.sender || 'user',
    created_at: msg.created_at,
  }));
}