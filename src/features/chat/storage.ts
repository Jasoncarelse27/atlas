import { supabase } from '@/lib/supabase';

export type ChatRole = 'user' | 'atlas';
export type Message = {
  id?: string;
  conversation_id?: string | null;
  user_id?: string | null;
  role: ChatRole;
  content: string;
  created_at?: string;
};

export async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function loadRecentMessages(limit = 50): Promise<Message[]> {
  if (!supabase) return [];
  const uid = await getUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('eq_messages')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as Message[];
}

export async function saveMessage(msg: Message) {
  if (!supabase) return;
  const uid = await getUserId();
  const row = { ...msg, user_id: uid ?? null };
  await supabase.from('eq_messages').insert(row);
}
