import { SUPABASE } from '@/config/chat';
import { createClient } from '@supabase/supabase-js';

export const hasSupabase =
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase = hasSupabase
  ? createClient(SUPABASE.url, SUPABASE.anon, { auth: { persistSession: true } })
  : (null as const);