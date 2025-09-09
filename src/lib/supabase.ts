import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '@/config/chat';

export const supabase =
  SUPABASE.url && SUPABASE.anon
    ? createClient(SUPABASE.url, SUPABASE.anon, { auth: { persistSession: true } })
    : null;