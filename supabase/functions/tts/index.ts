// supabase/functions/tts/index.ts
// Text-to-Speech using OpenAI TTS API
// ✅ PRODUCTION-GRADE: Timeout handling, circuit breaker, fallback, enhanced logging
import { serve } from "https://deno.land/std@0.170.0/http/server.ts";

// Simple in-memory rate limiting (for production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// ✅ Circuit breaker state
const circuitBreakerState = {
  failures: 0,
  lastFailureTime: 0,
  isOpen: false,
  THRESHOLD: 5, // Open circuit after 5 consecutive failures
  RESET_TIME: 60000, // Reset after 1 minute
};

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

// ✅ Circuit breaker check
function checkCircuitBreaker(): boolean {
  const now = Date.now();
  
  if (circuitBreakerState.isOpen) {
    // Check if reset time has passed
    if (now - circuitBreakerState.lastFailureTime > circuitBreakerState.RESET_TIME) {
      console.log('[TTS] Circuit breaker reset - attempting to close');
      circuitBreakerState.isOpen = false;
      circuitBreakerState.failures = 0;
      return true;
    }
    return false; // Circuit still open
  }
  
  return true; // Circuit closed - allow requests
}

function recordSuccess(): void {
  circuitBreakerState.failures = 0;
  circuitBreakerState.isOpen = false;
}

function recordFailure(): void {
  circuitBreakerState.failures++;
  circuitBreakerState.lastFailureTime = Date.now();
  
  if (circuitBreakerState.failures >= circuitBreakerState.THRESHOLD) {
    circuitBreakerState.isOpen = true;
    console.error(`[TTS] Circuit breaker OPEN - ${circuitBreakerState.failures} consecutive failures`);
  }
}

// ✅ Generate UUID for request tracking
function generateRequestId(): string {
  return crypto.randomUUID();
}

// ✅ Check if error is retryable
function isRetryableError(status: number, error: string): boolean {
  // Don't retry on auth errors (4xx)
  if (status >= 400 && status < 500 && status !== 429) {
    return false;
  }
  // Retry on server errors (5xx) and rate limits (429)
  return status >= 500 || status === 429;
}

// ✅ Check if error is timeout-related
function isTimeoutError(error: string): boolean {
  return error.includes('timeout') || error.includes('aborted') || error.includes('ETIMEDOUT');
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
  
  // ✅ Health check endpoint
  if (req.url.endsWith('/health') || req.url.includes('health')) {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    return new Response(JSON.stringify({
      status: openaiKey ? 'healthy' : 'unhealthy',
      service: 'tts',
      circuitBreaker: circuitBreakerState.isOpen ? 'open' : 'closed',
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  const startTime = Date.now();
  const clientIP = req.headers.get("x-forwarded-for") || "unknown";
  const requestId = req.headers.get("X-Request-ID") || generateRequestId();
  
  try {
    // ✅ Circuit breaker check
    if (!checkCircuitBreaker()) {
      return new Response(JSON.stringify({ 
        error: "Service temporarily unavailable",
        requestId,
        retryable: true,
        retryAfter: Math.ceil((circuitBreakerState.RESET_TIME - (Date.now() - circuitBreakerState.lastFailureTime)) / 1000),
      }), {
        status: 503,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "60"
        },
      });
    }
    
    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", requestId }), {
        status: 429,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "60"
        },
      });
    }

    const { text, voice = "nova", model = "tts-1" } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Validate model
    const validModels = ['tts-1', 'tts-1-hd'];
    const ttsModel = validModels.includes(model) ? model : 'tts-1';

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
      console.error(`[TTS] ${requestId}: OPENAI_API_KEY not configured`);
      recordFailure();
      return new Response(JSON.stringify({ 
        error: "TTS service not configured",
        requestId,
        retryable: false,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ Call OpenAI TTS API with timeout (50s to prevent Edge Function timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s timeout
    
    let ttsResponse: Response;
    let usedModel = ttsModel;
    
    try {
      ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ttsModel,
          input: text,
          voice: voice,
        }),
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // ✅ Fallback to tts-1 if HD model times out
      if (isTimeoutError(String(fetchError)) && ttsModel === 'tts-1-hd') {
        console.warn(`[TTS] ${requestId}: HD model timeout, falling back to standard model`);
        usedModel = 'tts-1';
        
        // Retry with standard model
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 50000);
        
        try {
          ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
            signal: fallbackController.signal,
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: 'tts-1',
              input: text,
              voice: voice,
            }),
          });
          clearTimeout(fallbackTimeout);
        } catch (fallbackError) {
          clearTimeout(fallbackTimeout);
          recordFailure();
          throw fallbackError;
        }
      } else {
        recordFailure();
        throw fetchError;
      }
    }

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      let errorJson: any;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { error: errorText };
      }
      
      const isRetryable = isRetryableError(ttsResponse.status, errorText);
      recordFailure();
      
      console.error(`[TTS] ${requestId}: OpenAI error (${ttsResponse.status}):`, errorJson);
      
      return new Response(JSON.stringify({ 
        error: "TTS generation failed",
        details: errorJson.error || errorText,
        requestId,
        retryable: isRetryable,
        code: ttsResponse.status,
      }), {
        status: ttsResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // ✅ Record success for circuit breaker
    recordSuccess();

    // Convert audio to base64 (chunked to avoid stack overflow)
    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioArray = new Uint8Array(audioBuffer);
    
    // Process in chunks to avoid stack overflow with large audio files
    let binaryString = '';
    const chunkSize = 8192; // Process 8KB at a time
    for (let i = 0; i < audioArray.length; i += chunkSize) {
      const chunk = audioArray.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binaryString);

    const latency = Date.now() - startTime;
    
    console.log(`[TTS] ${requestId}: Success - ${text.length} chars, ${audioArray.length} bytes, ${latency}ms, model: ${usedModel}, IP: ${clientIP}`);

    return new Response(
      JSON.stringify({ 
        base64Audio,
        latency_ms: latency,
        voice: voice,
        model: usedModel, // ✅ Return actual model used (may differ if fallback occurred)
        placeholder: false,
        size_bytes: audioArray.length,
        requestId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const latency = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isTimeout = isTimeoutError(errorMessage);
    
    recordFailure();
    
    console.error(`[TTS] ${requestId}: Error - ${errorMessage}, ${latency}ms, IP: ${clientIP}, timeout: ${isTimeout}`);
    
    return new Response(JSON.stringify({ 
      error: isTimeout ? "Request timeout - TTS service took too long" : "TTS generation failed",
      details: errorMessage,
      requestId,
      retryable: isTimeout, // Timeouts are retryable
      code: isTimeout ? 504 : 500,
    }), {
      status: isTimeout ? 504 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});