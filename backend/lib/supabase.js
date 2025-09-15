import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[Atlas] Missing backend Supabase env vars. Using mock client in DEV.');
    // Mock client avoids backend crash in dev
    supabase = { from: () => ({ select: async () => [] }) };
  } else {
    throw new Error('[Atlas] Missing Supabase backend env vars in PROD!');
  }
} else {
  console.log('[Atlas] Backend Supabase client created with:', supabaseUrl);
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: true, persistSession: false }
  });
}

export { supabase };
