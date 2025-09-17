// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!;

// Simple in-memory cache for conversation contexts
const conversationCache = new Map<string, { messages: any[], lastAccess: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';

    // Create a Supabase client that can read the user from the access token provided by the frontend
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userResult } = await supabase.auth.getUser();
    const currentUser = userResult?.user;
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { message, conversationId } = await req.json();
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get conversation context from cache or database
    let conversationContext: any[] = [];
    if (conversationId) {
      const cached = conversationCache.get(conversationId);
      if (cached && Date.now() - cached.lastAccess < CACHE_TTL) {
        conversationContext = cached.messages;
        cached.lastAccess = Date.now();
      } else {
        // Fetch recent messages from database (limit to last 10 for context)
        const { data: messages } = await supabase
          .from('webhook_logs')
          .select('payload')
          .eq('conversation_id', conversationId)
          .order('timestamp', { ascending: false })
          .limit(10);
        
        if (messages) {
          conversationContext = messages.map(m => m.payload).reverse();
          conversationCache.set(conversationId, {
            messages: conversationContext,
            lastAccess: Date.now()
          });
        }
      }
    }

    // Build messages array for LLM
    const messages = [
      ...conversationContext,
      { role: 'user', content: message }
    ];

    // Free-tier default model: Llama 3.1 8B Instruct via OpenRouter
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: messages,
        temperature: 0.7,
        max_tokens: 150 // Limit response length for cost control
      })
    });

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      return new Response(JSON.stringify({ error: `LLM request failed: ${errText}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const llmJson = await openRouterResponse.json();
    const text = llmJson?.choices?.[0]?.message?.content ?? 'Sorry, no response.';

    // Save the AI response to the database in the background (non-blocking)
    if (conversationId) {
      // Update cache with new message
      const newMessage = { role: 'assistant', content: text };
      const cached = conversationCache.get(conversationId);
      if (cached) {
        cached.messages.push(newMessage);
        cached.lastAccess = Date.now();
        // Keep only last 10 messages in cache
        if (cached.messages.length > 10) {
          cached.messages = cached.messages.slice(-10);
        }
      }

      // Save to database asynchronously (don't await)
      supabase
        .from('webhook_logs')
        .insert([{
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          user_id: currentUser.id,
          payload: {
            role: 'assistant',
            content: text,
            timestamp: new Date().toISOString()
          },
          source: 'assistant',
          timestamp: new Date().toISOString(),
          role: 'assistant'
        }])
        .then(() => console.log('Message saved to database'))
        .catch((error) => console.error('Background save error:', error));
    }

    return new Response(JSON.stringify({ response: text }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});


