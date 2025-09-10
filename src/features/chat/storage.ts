// src/features/chat/storage.ts
import { supabase } from "@/lib/supabase";
import { Message } from "@/stores/useMessageStore";

// ✅ Save a single message to Supabase
export async function saveMessage(message: Message) {
  // Convert store format to Supabase format
  const supabaseMessage = {
    id: message.id,
    role: message.role,
    content: message.content,
    created_at: message.createdAt,
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
  return (data || []).map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.created_at,
  }));
}