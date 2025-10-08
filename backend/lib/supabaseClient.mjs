// Supabase client for backend logging
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

// Only initialize if we have credentials
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('✅ Supabase client initialized for logging');
} else {
  // Create mock client for development
  supabase = {
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
      select: () => Promise.resolve({ data: [], error: null })
    })
  };
}

export { supabase };
