// backend/config/supabaseClient.mjs
import { logger } from '../lib/simpleLogger.mjs';
import { createClient } from "@supabase/supabase-js";
import dns from 'dns';

// ✅ CRITICAL: Force IPv4 for Railway compatibility
// Railway doesn't support IPv6 connections
dns.setDefaultResultOrder('ipv4first');

// Function to create and validate Supabase clients
function createSupabaseClients() {
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
    throw new Error(`Supabase not configured - missing: ${missingVars.join(', ')}`);
  }

  // Create Supabase client with service role key for backend operations
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    // ✅ SCALABILITY FIX: Connection reuse for 10k+ users
    // Note: Supabase manages database connection pooling server-side via PgBouncer
    // Client-side HTTP connection reuse is handled by Node.js HTTP Agent (configured in server.mjs)
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Prefer-IPv4': 'true',
        'Connection': 'keep-alive', // ✅ HTTP connection reuse (Node.js handles pooling via Agent)
      },
      // ✅ BEST PRACTICE: Use default fetch (Node.js 18+ uses undici with built-in connection pooling)
      // No custom fetch override needed - Node.js handles connection reuse automatically
    }
  });

  // Create public client with anon key for frontend-like operations
  const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    // ✅ SCALABILITY FIX: Connection reuse for 10k+ users
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Prefer-IPv4': 'true',
        'Connection': 'keep-alive', // ✅ HTTP connection reuse
      },
      // ✅ BEST PRACTICE: Use default fetch (Node.js handles pooling)
    }
  });

  logger.debug('✅ Supabase client initialized successfully');
  logger.debug(`✅ Supabase URL: ${SUPABASE_URL}`);
  logger.debug(`✅ Service role key: ${SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}`);
  logger.debug(`✅ Anon key: ${SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}`);

  return { supabase, supabasePublic };
}

// Lazy initialization - clients created on first access
let _supabase = null;
let _supabasePublic = null;

export const supabase = new Proxy({}, {
  get(target, prop) {
    if (!_supabase) {
      const clients = createSupabaseClients();
      _supabase = clients.supabase;
      _supabasePublic = clients.supabasePublic;
    }
    return _supabase[prop];
  }
});

export const supabasePublic = new Proxy({}, {
  get(target, prop) {
    if (!_supabasePublic) {
      const clients = createSupabaseClients();
      _supabase = clients.supabase;
      _supabasePublic = clients.supabasePublic;
    }
    return _supabasePublic[prop];
  }
});
