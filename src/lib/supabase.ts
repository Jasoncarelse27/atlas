import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase;

if (!supabaseUrl || !supabaseAnonKey) {
  if (import.meta.env.DEV) {
    console.warn('[Atlas] Missing frontend Supabase env vars. Using mock client in DEV.');
    // Mock client avoids crashes in dev
    // @ts-ignore
    supabase = { auth: { onAuthStateChange: () => {} } };
  } else {
    throw new Error('[Atlas] Missing Supabase frontend env vars in PROD build!');
  }
} else {
  console.log('[Atlas] Frontend Supabase client created with:', supabaseUrl);
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
