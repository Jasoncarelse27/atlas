// supabase/functions/tts/index.ts
import { serve } from "https://deno.land/std@0.170.0/http/server.ts";

// Simple in-memory rate limiting (for production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const key = `${ip}`;
  const current = rateLimitMap.get(key);
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (current.count >= maxRequests) {
    return false;
  }
  
  current.count++;
  return true;
}

serve(async (req: Request) => {
  const startTime = Date.now();
  const clientIP = req.headers.get("x-forwarded-for") || "unknown";
  
  try {
    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { 
          "Content-Type": "application/json",
          "Retry-After": "60"
        },
      });
    }

    // Basic security: check origin header
    const origin = req.headers.get("origin");
    const allowedOrigins = [
      "https://atlas-production-2123.up.railway.app",
      "http://localhost:5173",
      "http://localhost:3000"
    ];
    
    if (origin && !allowedOrigins.includes(origin)) {
      console.warn(`Blocked request from origin: ${origin}`);
      return new Response(JSON.stringify({ error: "Forbidden origin" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { text, voice = "en-US-JennyNeural" } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Limit text length to prevent abuse
    if (text.length > 1000) {
      return new Response(JSON.stringify({ error: "Text too long (max 1000 chars)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // For now, return a placeholder TTS response
    // TODO: Implement actual TTS service integration
    const latency = Date.now() - startTime;
    
    // Log successful request
    console.log(`TTS placeholder: ${text.length} chars, ${latency}ms, IP: ${clientIP}`);

    // Return a minimal audio file (silence) as base64
    // This is a placeholder until we integrate a real TTS service
    const placeholderAudio = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

    return new Response(
      JSON.stringify({ 
        base64Audio: placeholderAudio,
        latency_ms: latency,
        voice: voice,
        placeholder: true
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const latency = Date.now() - startTime;
    console.error(`TTS Error: ${err}, ${latency}ms, IP: ${clientIP}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
