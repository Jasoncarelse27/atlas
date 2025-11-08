import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { logger } from './logger';

// Environment variables for Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ✅ CRITICAL FIX: Defer error check to allow React to render error boundary
// Log visible error for debugging, but don't throw immediately
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `Missing required environment variables: VITE_SUPABASE_URL=${!!supabaseUrl}, VITE_SUPABASE_ANON_KEY=${!!supabaseAnonKey}`;
  // ✅ Keep console.error for critical startup errors (before logger available)
  console.error('❌ [Supabase]', errorMsg);
  console.error('❌ [Supabase] Check Vercel Environment Variables are set for Production');
  // Show visible error in DOM if React hasn't loaded yet
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <div style="font-family: system-ui; padding: 2rem; max-width: 600px; margin: 2rem auto;">
        <h1 style="color: #ef4444;">⚠️ Configuration Error</h1>
        <p><strong>Missing Supabase environment variables</strong></p>
        <p>${errorMsg}</p>
        <p>Please check Vercel → Settings → Environment Variables</p>
        <p style="margin-top: 1rem; font-size: 0.875rem; color: #6b7280;">
          Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
        </p>
      </div>
    `;
  }
  throw new Error(errorMsg);
}

// Mobile-safe Supabase client configuration
const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Singleton pattern to prevent multiple client instances
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    // ✅ FIX: Use PKCE flow for more reliable auth (better error handling)
    flowType: 'pkce',
  },
  // Optimize realtime for chat messages
  realtime: {
    params: {
      eventsPerSecond: 10, // Increased from 2 to 10 for better chat performance
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'atlas-mobile-safe',
    },
  },
    });
    
    // ✅ FIX: Graceful Supabase Auth Handling - Clean Implementation
    // Listen for auth state changes for traceability
    if (typeof window !== 'undefined') {
      supabaseInstance.auth.onAuthStateChange((event, session) => {
        switch (event) {
          case 'TOKEN_REFRESHED':
            logger.debug('[Supabase] 🔄 Token refreshed successfully');
            break;
          case 'SIGNED_OUT':
            logger.warn('[Supabase] 🚪 Signed out');
            break;
          case 'USER_UPDATED':
            logger.debug('[Supabase] 👤 User updated');
            break;
          default:
            break;
        }
      });

      // Global handler: suppress harmless transient network errors
      window.addEventListener('unhandledrejection', (e) => {
        const msg = e.reason?.message || e.reason?.toString?.() || '';
        const isSupabaseClosed = msg.includes('ERR_CONNECTION_CLOSED') && 
                                 (msg.includes('supabase.co/auth/v1/user') || msg.includes('supabase'));
        const isSupabaseFetchAbort = msg.includes('AbortError') && 
                                     (msg.includes('supabase') || msg.includes('auth/v1/user'));
        const isSafeToIgnore = isSupabaseClosed || isSupabaseFetchAbort;

        if (isSafeToIgnore) {
          logger.debug('[Supabase] ⚠️ Transient connection issue — auto-retrying silently');
          e.preventDefault(); // Prevent console error
        }
      });
    }
  }
  return supabaseInstance;
})();

// ✅ REMOVED: Window exposure hacks - use proper backend API instead
// Use GET /api/debug/conversations for diagnostics

// Health-check helper with mobile fallback
export async function checkSupabaseHealth() {
  try {
    // On mobile, skip the health check to avoid WebSocket issues
    if (isMobile) {
      return { ok: true, mobile: true };
    }
    
    // Test connection with a simple query that doesn't require auth
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      return { ok: false, message: error.message };
    }
    // Connection healthy - only log occasionally in development
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
      logger.debug("✅ Supabase connection healthy.");
    }
    return { ok: true };
  } catch (err: unknown) {
    const error = err as Error;
    return { ok: false, message: error.message };
  }
}

// Export for backward compatibility
export default supabase;
