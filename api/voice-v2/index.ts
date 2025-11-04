// Edge Function for Voice V2 - Proxy to Fly.io
// Runtime: Vercel Edge (Deno-compatible)
// This proxies WebSocket connections to the Fly.io server

export const config = {
  runtime: 'edge',
};

// Use process.env for Vercel Edge compatibility (works in both Deno and Node contexts)
const FLY_IO_WS_URL = (typeof process !== 'undefined' && process.env?.VITE_VOICE_V2_URL) || 
                       (typeof Deno !== 'undefined' && Deno.env?.get('VITE_VOICE_V2_URL')) ||
                       'wss://atlas-voice-v2.fly.dev';

/**
 * 🎙️ Voice V2 - WebSocket Proxy
 * 
 * Proxies WebSocket connections to Fly.io server (where actual processing happens).
 * This allows Vercel Edge Functions to handle WebSocket upgrades and forward to Fly.io.
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

  // For Vercel Edge, we can't directly proxy WebSocket upgrades
  // Instead, return a redirect response telling client to connect directly to Fly.io
  return new Response(JSON.stringify({
    type: 'redirect',
    websocket_url: FLY_IO_WS_URL,
    message: 'Connect directly to Fly.io WebSocket server',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-WebSocket-URL': FLY_IO_WS_URL,
    },
  });
}
