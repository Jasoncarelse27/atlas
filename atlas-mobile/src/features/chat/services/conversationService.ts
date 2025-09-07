import { v4 as uuid } from 'uuid';
import { supabase } from '@/lib/supabase';

export type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
};

export async function listMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as Message[];
}

export async function insertUserMessage(conversationId: string, content: string): Promise<Message> {
  const row: Message = { id: uuid(), conversation_id: conversationId, role: 'user', content };
  const { data, error } = await supabase.from('messages').insert(row).select().single();
  if (error) throw error;
  return data as Message;
}
