// supabase/functions/stt/index.ts
// Speech-to-Text using OpenAI Whisper API
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
    // Rate limiting (stricter for STT due to processing cost)
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

    const { audio } = await req.json();

    if (!audio) {
      return new Response(JSON.stringify({ error: "Missing audio data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic validation: check if audio data is reasonable size
    const audioSize = (audio.length * 3) / 4; // Approximate base64 to bytes
    if (audioSize > 10 * 1024 * 1024) { // 10MB limit
      return new Response(JSON.stringify({ error: "Audio file too large" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get OpenAI API key from environment
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(JSON.stringify({ error: "STT service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert base64 to blob for Whisper API
    const audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });
    
    // Create form data for Whisper API
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    // Call OpenAI Whisper API
    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const error = await whisperResponse.text();
      console.error("Whisper API error:", error);
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: whisperResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await whisperResponse.json();
    const latency = Date.now() - startTime;
    
    console.log(`STT success: "${result.text.substring(0, 50)}...", ${latency}ms, IP: ${clientIP}`);
    
    return new Response(
      JSON.stringify({ 
        text: result.text,
        confidence: 0.95, // Whisper doesn't return confidence, use high value
        language: "en",
        latency_ms: latency,
        audio_size_bytes: audioSize
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const latency = Date.now() - startTime;
    console.error(`STT Error: ${err}, ${latency}ms, IP: ${clientIP}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});