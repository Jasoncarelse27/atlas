import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // Check if we're in CI environment
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  if (process.env.NODE_ENV !== 'production' || isCI) {
    console.warn('[Atlas] Missing backend Supabase env vars. Using mock client in DEV/CI.');
    // Mock client avoids backend crash in dev/ci
    supabase = { 
      from: () => ({ 
        select: async () => ({ data: [], error: null }),
        insert: async () => ({ data: [], error: null }),
        update: async () => ({ data: [], error: null }),
        delete: async () => ({ data: [], error: null }),
        upsert: async () => ({ data: [], error: null })
      }),
      rpc: async () => ({ data: null, error: null }),
      storage: {
        from: () => ({
          upload: async () => ({ data: { path: 'mock/path' }, error: null })
        })
      }
    };
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
