// supabase/functions/stt/index.ts
import { serve } from "https://deno.land/std@0.170.0/http/server.ts";

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, maxRequests: number = 30, windowMs: number = 60000): boolean {
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
    // Rate limiting (stricter for STT due to processing cost)
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
      "http://localhost:5174",
      "http://localhost:3000"
    ];
    
    if (origin && !allowedOrigins.includes(origin)) {
      console.warn(`Blocked STT request from origin: ${origin}`);
      return new Response(JSON.stringify({ error: "Forbidden origin" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { audio } = await req.json();

    if (!audio) {
      return new Response(JSON.stringify({ error: "Missing audio data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Basic validation: check if audio data is reasonable size
    const audioSize = (audio.length * 3) / 4; // Approximate base64 to bytes
    if (audioSize > 10 * 1024 * 1024) { // 10MB limit
      return new Response(JSON.stringify({ error: "Audio file too large" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const latency = Date.now() - startTime;
    
    // For now, return a placeholder response
    // TODO: Integrate with actual STT service (Whisper, etc.)
    // This is a fallback when Nova backend is not available
    
    console.log(`STT placeholder: ${audioSize} bytes, ${latency}ms, IP: ${clientIP}`);
    
    return new Response(
      JSON.stringify({ 
        text: "Audio transcription placeholder - please implement actual STT service",
        confidence: 0.8,
        language: "en",
        latency_ms: latency,
        audio_size_bytes: audioSize
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const latency = Date.now() - startTime;
    console.error(`STT Error: ${err}, ${latency}ms, IP: ${clientIP}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
