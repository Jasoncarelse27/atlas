// Edge Function for Voice V2 - Proxy to Fly.io
// Runtime: Vercel Edge (Deno-compatible)
// This proxies WebSocket connections to the Fly.io server

export const config = {
  runtime: 'edge',
};

// Vercel Edge Functions use process.env (not Deno.env)
const FLY_IO_WS_URL = process.env.VITE_VOICE_V2_URL || 'wss://atlas-voice-v2.fly.dev';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

/**
 * 🎙️ Voice V2 - WebSocket Proxy with Authentication
 * 
 * Validates JWT token before redirecting to Fly.io WebSocket server.
 * This provides defense-in-depth security (Fly.io also validates, but this prevents unauthorized connection attempts).
 */
export default async function handler(req: Request): Promise<Response> {
  // Handle WebSocket upgrade
  const upgrade = req.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    // Health check endpoint
    if (req.url.endsWith('/health')) {
      return new Response(JSON.stringify({
        status: 'healthy',
        proxy: true,
        target: FLY_IO_WS_URL,
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Expected WebSocket upgrade or use /health', { status: 426 });
  }

  // ✅ SECURITY: Extract and validate JWT token before redirect
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || 
                req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return new Response(JSON.stringify({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
      message: 'Token must be provided in query parameter or Authorization header'
    }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ✅ SECURITY: Validate token with Supabase
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // If env vars not set, log warning but allow through (development)
    console.warn('[VoiceV2 Edge] Supabase credentials not configured - skipping auth validation');
  } else {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return new Response(JSON.stringify({ 
          error: 'Invalid or expired authentication token',
          code: 'AUTH_INVALID',
          message: error?.message || 'Authentication failed'
        }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // ✅ Token validated - proceed with redirect
    } catch (authError) {
      console.error('[VoiceV2 Edge] Auth validation error:', authError);
      return new Response(JSON.stringify({ 
        error: 'Authentication validation failed',
        code: 'AUTH_ERROR',
        message: 'Unable to validate token'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // ✅ SECURITY: Only redirect if token is valid (or env vars not set for dev)
  // Include token in redirect URL so Fly.io can validate again (defense-in-depth)
  return new Response(JSON.stringify({
    type: 'redirect',
    websocket_url: `${FLY_IO_WS_URL}?token=${encodeURIComponent(token)}`,
    message: 'Connect directly to Fly.io WebSocket server',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-WebSocket-URL': `${FLY_IO_WS_URL}?token=${encodeURIComponent(token)}`,
    },
  });
}
