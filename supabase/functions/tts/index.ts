// supabase/functions/tts/index.ts
// Text-to-Speech using OpenAI TTS API
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  const clientIP = req.headers.get("x-forwarded-for") || "unknown";
  
  try {
    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "60"
        },
      });
    }

    const { text, voice = "nova" } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit text length to prevent abuse
    if (text.length > 4000) {
      return new Response(JSON.stringify({ error: "Text too long (max 4000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get OpenAI API key from environment
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(JSON.stringify({ error: "TTS service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call OpenAI TTS API
    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1", // Use tts-1-hd for higher quality (2x cost)
        input: text,
        voice: voice, // alloy, echo, fable, onyx, nova, shimmer
      }),
    });

    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      console.error("OpenAI TTS error:", error);
      return new Response(JSON.stringify({ error: "TTS generation failed" }), {
        status: ttsResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert audio to base64
    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioArray = new Uint8Array(audioBuffer);
    const base64Audio = btoa(String.fromCharCode(...audioArray));

    const latency = Date.now() - startTime;
    
    console.log(`TTS success: ${text.length} chars, ${audioArray.length} bytes, ${latency}ms, IP: ${clientIP}`);

    return new Response(
      JSON.stringify({ 
        base64Audio,
        latency_ms: latency,
        voice: voice,
        placeholder: false,
        size_bytes: audioArray.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const latency = Date.now() - startTime;
    console.error(`TTS Error: ${err}, ${latency}ms, IP: ${clientIP}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});