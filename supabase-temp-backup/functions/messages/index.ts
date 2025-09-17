// supabase/functions/messages/index.ts
// Atlas AI Message Storage Edge Function
// Handles storing chat messages in Supabase with conversation tracking and streaming

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

export const POST = async (req: Request): Promise<Response> => {
  try {
    // Check Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ 
        error: 'Missing or invalid authorization header' 
      }), { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Validate JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Invalid JWT token' 
      }), { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      });
    }

    const { message, conversationId, tier = 'free' } = await req.json()

    // Basic validation
    if (!message || !conversationId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: message, conversationId' 
      }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      })
    }

    // Check if streaming is requested
    const url = new URL(req.url);
    const isStreaming = url.searchParams.get('stream') === '1';

    if (isStreaming) {
      // Return streaming response
      const stream = new ReadableStream({
        start(controller) {
          // Simulate AI streaming response
          const response = `This is a streaming response to: "${message}". Your message has been processed and stored. This is a demo of the streaming functionality.`;
          const words = response.split(' ');
          
          let currentIndex = 0;
          const streamWords = () => {
            if (currentIndex < words.length) {
              const chunk = words[currentIndex] + ' ';
              controller.enqueue(new TextEncoder().encode(chunk));
              currentIndex++;
              setTimeout(streamWords, 100); // Stream every 100ms
            } else {
              controller.close();
            }
          };
          
          streamWords();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      });
    }

    // Store message in Supabase (non-streaming mode)
    const { data, error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'user',
      content: message
    })

    if (error) {
      console.error('Supabase insert error:', error)
      return new Response(JSON.stringify({ 
        error: error.message,
        details: error.details,
        hint: error.hint
      }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Message stored successfully',
      data: data
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    })
  } catch (e) {
    console.error('Server error:', e)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: e instanceof Error ? e.message : 'Unknown error'
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    })
  }
}

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400'
    }
  })
}

// Health check endpoint
export const GET = async () => {
  return new Response(JSON.stringify({ 
    status: 'healthy',
    function: 'messages',
    timestamp: new Date().toISOString(),
    supabase: supabaseUrl ? 'configured' : 'missing_url',
    features: ['message_storage', 'streaming', 'jwt_auth']
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
