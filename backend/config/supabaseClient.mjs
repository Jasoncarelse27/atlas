// backend/config/supabaseClient.mjs
import { createClient } from "@supabase/supabase-js";

// Validate required environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check for missing variables
const missingVars = [];
if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
if (!SUPABASE_ANON_KEY) missingVars.push('SUPABASE_ANON_KEY');
if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

if (missingVars.length > 0) {
  console.error(`[ERROR] Missing Supabase environment variables: ${missingVars.join(', ')}`);
  console.error('[ERROR] Please check your .env file or Railway configuration');
  throw new Error(`Supabase not configured - missing: ${missingVars.join(', ')}`);
}

// Create Supabase client with service role key for backend operations
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Create public client with anon key for frontend-like operations
export const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

console.log('✅ Supabase client initialized successfully');
console.log(`✅ Supabase URL: ${SUPABASE_URL}`);
console.log(`✅ Service role key: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...`);
console.log(`✅ Anon key: ${SUPABASE_ANON_KEY.substring(0, 10)}...`);
