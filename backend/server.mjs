import { createClient } from '@supabase/supabase-js';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { processMessage } from './services/messageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || process.env.NOVA_BACKEND_PORT || 8000;

// Initialize Supabase client with fallback for development
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

let supabase;
try {
  if (supabaseUrl === 'https://your-project.supabase.co' || process.env.NODE_ENV === 'development') {
    // Development mode - create a mock client
    supabase = {
      auth: {
        getUser: async (token) => {
          if (token === 'mock-token-for-development') {
            return { data: { user: { id: '550e8400-e29b-41d4-a716-446655440000' } }, error: null };
          }
          return { data: { user: null }, error: new Error('Invalid token') };
        }
      },
      from: (_table) => ({
        select: (_columns) => ({
          eq: (_column, _value) => ({
            eq: (_column2, _value2) => ({
              maybeSingle: () => Promise.resolve({ data: { tier: 'free', status: 'active' }, error: null })
            }),
            maybeSingle: () => Promise.resolve({ data: { tier: 'free', status: 'active' }, error: null }),
            single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } })
          }),
          single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } })
        }),
        insert: (data) => ({
          select: () => ({
            single: () => Promise.resolve({ data: data[0], error: null })
          })
        })
      })
    };
  } else {
    // Production mode - use real Supabase client
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables');
      process.exit(1);
    }
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error);
  process.exit(1);
}

// External AI API keys
const ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.VITE_CLAUDE_API_KEY;

// Log API key availability
console.log('🔑 API Keys Status:');
console.log(`  Claude/Anthropic: ${ANTHROPIC_API_KEY ? '✅ Available' : '❌ Missing'}`);
if (!ANTHROPIC_API_KEY) {
  console.log('⚠️  No AI API key found - will use mock responses');
}

// Model mapping by tier
const _mapTierToAnthropicModel = (tier) => {
  if (tier === 'studio') return 'claude-3-5-opus';
  return 'claude-3-5-sonnet';
};

// Stream helper: write SSE data chunk
const writeSSE = (res, payload) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  // Force flush for Safari/iOS compatibility
  if (res.flush) res.flush();
};

// Stream Anthropic response with proper SSE handling
async function streamAnthropicResponse({ content, model, res }) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Missing Anthropic API key');
  }
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      stream: true,
      messages: [{ role: 'user', content }]
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Anthropic request failed');
    console.error('❌ Anthropic API Error:', errText);
    throw new Error(`Anthropic API Error: ${errText}`);
  }
  
  if (!response.body) {
    throw new Error('No response body from Anthropic API');
  }

  // Proper SSE streaming with chunk processing
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              // Send chunk to client using writeSSE helper
              writeSSE(res, { chunk: parsed.delta.text });
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  return fullText;
}


// Enhanced JWT verification middleware with development fallback
const verifyJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('🔐 JWT: Missing or invalid authorization header');
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header',
        details: 'Please ensure you are logged in and try again'
      });
    }

    const token = authHeader.substring(7);
    
    // Development mode: allow mock token or bypass for local testing
    if (token === 'mock-token-for-development' || process.env.NODE_ENV === 'development') {
      console.log('🔐 JWT: Using development mode bypass');
      req.user = { id: '550e8400-e29b-41d4-a716-446655440000' };
      return next();
    }
    
    // Enhanced Supabase JWT verification with better error handling
    console.log('🔐 JWT: Verifying token with Supabase...');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('🔐 JWT: Supabase verification error:', error.message);
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        details: error.message,
        code: 'TOKEN_VERIFICATION_FAILED'
      });
    }
    
    if (!user) {
      console.error('🔐 JWT: No user found in token');
      return res.status(401).json({ 
        error: 'No user found in token',
        details: 'Token may be expired or invalid',
        code: 'NO_USER_IN_TOKEN'
      });
    }

    console.log('🔐 JWT: Token verified successfully for user:', user.id);
    req.user = user;
    next();
  } catch (error) {
    console.error('🔐 JWT: Unexpected error during verification:', error);
    res.status(401).json({ 
      error: 'Token verification failed',
      details: error.message,
      code: 'UNEXPECTED_ERROR'
    });
  }
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://*.supabase.co",
        "https://openrouter.ai",
        "https://api.anthropic.com",
        "ws://localhost:*",
        "wss://localhost:*"
      ],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));
app.use(compression({
  filter: (req, res) => {
    // Disable compression for streaming responses
    if (req.path === '/message' && req.query.stream === '1') {
      return false;
    }
    return compression.filter(req, res);
  }
}));
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['*']
    : [
        'http://localhost:5174', 
        'http://localhost:5175',
        'http://localhost:5173', 
        'http://localhost:3000', 
        'http://localhost:8081', 
        'http://127.0.0.1:8081', 
        'exp://127.0.0.1:19000', 
        'http://localhost:19006',
        'exp://10.46.30.39:8081',
        'exp://10.46.30.39:8083',
        'http://localhost:8083'
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Accept']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint for Railway
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Health check at /api (for consistency)
app.get('/api/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Test ping endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Atlas backend is alive!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    backend: 'node'
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    message: 'Atlas Backend API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Authentication status endpoint for debugging
app.get('/api/auth/status', (req, res) => {
  const authHeader = req.headers.authorization;
  const hasToken = authHeader && authHeader.startsWith('Bearer ');
  
  res.json({
    hasAuthHeader: !!authHeader,
    hasValidFormat: hasToken,
    environment: process.env.NODE_ENV || 'development',
    developmentMode: process.env.NODE_ENV === 'development',
    timestamp: new Date().toISOString()
  });
});

// ✅ Clean message endpoint with secure Supabase tier routing
app.post('/message', async (req, res) => {
  console.log('🔥 [/message] Handler ACTIVE – secure Supabase tier routing');
  
  try {
    // Handle both frontend formats: {message, tier} and {text, userId}
    const { message, text, tier, userId } = req.body;
    const messageText = text || message;
    const userTier = tier;
    
    if (!messageText) {
      return res.status(400).json({ error: 'Missing message text' });
    }

    console.log('🧠 [MessageService] Processing:', { userId, text: messageText, tier: userTier });

    const { reply, model, tier: detectedTier } = await processMessage(userId || null, messageText);

    res.json({
      success: true,
      model,
      tier: detectedTier,
      reply,
    });
  } catch (err) {
    console.error('❌ [/message] Error:', err);
    res.status(500).json({ error: 'Message processing failed' });
  }
});

// Legacy endpoint for backward compatibility
app.post('/api/message', verifyJWT, async (req, res) => {
  try {
    const { message, conversationId, model = 'claude', userTier, userId: _userIdBody } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Determine effective tier from DB if not provided
    let effectiveTier = userTier;
    if (!effectiveTier) {
      try {
        const { data: subRow } = await supabase
          .from('subscriptions')
          .select('tier, status')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
        effectiveTier = subRow?.tier || 'free';
      } catch (error) {
        console.error('Error fetching subscription:', error);
        effectiveTier = 'free'; // Default to free tier
      }
    }

    // Enforce Free tier daily limit (2 messages/day) - skip in development
    if (effectiveTier === 'free' && supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { count: dailyCount, error: countErr } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('role', 'user')
          .gte('created_at', startOfDay.toISOString());
        if (countErr) {
          console.error('Count error:', countErr);
        }
        if ((dailyCount ?? 0) >= 2) {
          return res.status(429).json({
            error: 'Daily limit reached for Free tier',
            upgrade_required: true,
            tier: effectiveTier,
            limits: { daily_messages: 2 }
          });
        }
      } catch (error) {
        console.error('Error checking daily limit:', error);
        // Continue without limit check in case of error
      }
    }

    // Store message in Supabase - skip in development mode
    const messageData = {
      id: uuidv4(),
      conversation_id: conversationId || uuidv4(),
      user_id: userId,
      role: 'user',
      message_type: 'user',
      content: {
        type: 'text',
        text: message.trim()
      },
      model: model,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    let storedMessage = messageData;
    if (supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        const { data: stored, error: insertError } = await supabase
          .from('messages')
          .insert([messageData])
          .select()
          .single();

        if (insertError) {
          console.error('Error storing message:', insertError);
          // Continue without storing in case of error
        } else {
          storedMessage = stored;
        }
      } catch (error) {
        console.error('Error storing message:', error);
        // Continue without storing in case of error
      }
    }

    // 🎯 Dynamic model selection based on user tier
    let selectedModel = 'claude-3-5-sonnet'; // Default
    let routedProvider = 'claude';
    
    if (effectiveTier === 'studio') {
      selectedModel = 'claude-3-5-opus';
      routedProvider = 'claude';
    } else if (effectiveTier === 'core') {
      selectedModel = 'claude-3-5-sonnet';
      routedProvider = 'claude';
    } else {
      // Free tier - use Claude Haiku for cost efficiency
      selectedModel = 'claude-3-5-haiku-20241022';
      routedProvider = 'claude';
    }
    
    console.log(`🎯 User tier: ${effectiveTier}, Selected model: ${selectedModel}, Provider: ${routedProvider}`);

    // Handle optional mock streaming via SSE
    const wantsStream = req.query.stream === '1' || (req.headers.accept || '').includes('text/event-stream');

    if (wantsStream) {
      // Set proper headers for streaming with writeHead
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
      });

      // Send initial keep-alive
      res.write(': keep-alive\n\n');

      let finalText = '';
      try {
        console.log(`🧠 Atlas model routing: user ${userId} has tier '${effectiveTier}' → model '${selectedModel}' (provider: ${routedProvider})`);
        
        // 🎯 Real AI Model Logic - Use Claude based on tier
        if (routedProvider === 'claude' && ANTHROPIC_API_KEY) {
          console.log('🚀 Streaming Claude response...');
          finalText = await streamAnthropicResponse({ content: message.trim(), model: selectedModel, res });
          console.log('✅ Claude streaming completed, final text length:', finalText.length);
        } else if (ANTHROPIC_API_KEY) {
          // Fallback to Claude if available
          console.log('🔄 Falling back to Claude...');
          finalText = await streamAnthropicResponse({ content: message.trim(), model: selectedModel, res });
          console.log('✅ Claude fallback completed, final text length:', finalText.length);
        } else {
          console.log('⚠️ No AI API keys available, using mock streaming...');
          console.log(`   Claude API Key: ${ANTHROPIC_API_KEY ? 'Present' : 'Missing'}`);
          // Fallback mock streaming for mobile
          const mockChunks = [
            'Hello! I received your message: ',
            `"${message.trim()}". `,
            'This is a simplified version of your Atlas app running on mobile! ',
            'The streaming is working properly now.'
          ];
          
          for (const chunk of mockChunks) {
            console.log('Sending chunk:', chunk);
            writeSSE(res, { chunk });
            // Force flush for Safari/iOS
            if (res.flush) res.flush();
            await new Promise(r => setTimeout(r, 200));
          }
          finalText = mockChunks.join('');
          console.log('Mock streaming completed, final text length:', finalText.length);
        }
      } catch (streamErr) {
        console.error('Streaming error:', streamErr);
        // Send error as SSE chunk
        writeSSE(res, { chunk: 'Sorry, I hit an error generating the response.' });
        finalText = 'Sorry, I hit an error generating the response.';
      }

      // Persist assistant message after stream completes - skip in development mode
      const aiResponse = {
        id: uuidv4(),
        conversation_id: messageData.conversation_id,
        user_id: userId,
        role: 'assistant',
        message_type: 'assistant',
        content: { type: 'text', text: finalText },
        model: selectedModel,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      
      let storedResponse = aiResponse;
      if (supabaseUrl !== 'https://your-project.supabase.co') {
        try {
          const { data: stored, error: responseError } = await supabase
            .from('messages')
            .insert([aiResponse])
            .select()
            .single();
          if (responseError) {
            console.error('Error storing AI response:', responseError);
          } else {
            storedResponse = stored;
          }
        } catch (error) {
          console.error('Error storing AI response:', error);
        }
      }
      
      // Send completion signal
      writeSSE(res, { done: true, response: storedResponse, conversationId: messageData.conversation_id });
      res.end();
      return;
    }

    // One-shot mode with real AI models
    let finalText = `(${effectiveTier}) Reply via ${routedProvider}: I received your message: "${message}".`;
    try {
      if (routedProvider === 'claude' && ANTHROPIC_API_KEY) {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: selectedModel,
            max_tokens: 2000,
            messages: [{ role: 'user', content: message.trim() }]
          })
        });
        const data = await r.json();
        finalText = data?.content?.[0]?.text || finalText;
      } else if (ANTHROPIC_API_KEY) {
        // Fallback to Claude
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: selectedModel,
            max_tokens: 2000,
            messages: [{ role: 'user', content: message.trim() }]
          })
        });
        const data = await r.json();
        finalText = data?.content?.[0]?.text || finalText;
      }
    } catch (oneShotErr) {
      console.error('One-shot provider error:', oneShotErr);
    }

    const aiResponse = {
      id: uuidv4(),
      conversation_id: messageData.conversation_id,
      user_id: userId,
      role: 'assistant',
      message_type: 'assistant',
      content: { type: 'text', text: finalText },
      model: selectedModel,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    let storedResponse = aiResponse;
    if (supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        const { data: stored, error: responseError } = await supabase
          .from('messages')
          .insert([aiResponse])
          .select()
          .single();
        if (responseError) {
          console.error('Error storing AI response:', responseError);
        } else {
          storedResponse = stored;
        }
      } catch (error) {
        console.error('Error storing AI response:', error);
      }
    }

    res.json({
      success: true,
      message: storedMessage,
      response: storedResponse,
      conversationId: messageData.conversation_id
    });

  } catch (error) {
    console.error('Message processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Image analysis endpoint using Claude Vision
app.post('/api/image-analysis', verifyJWT, async (req, res) => {
  try {
    const { imageUrl, userId, prompt = "Analyze this image and provide detailed insights about what you see." } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    console.log('🖼️ [Image Analysis] Processing image:', imageUrl);

    // Call Claude Vision API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: imageUrl
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Claude Vision API error');
      console.error('❌ Claude Vision API Error:', errorText);
      return res.status(500).json({ 
        error: 'Image analysis failed',
        details: errorText
      });
    }

    const result = await response.json();
    const analysis = result.content[0].text;

    console.log('✅ [Image Analysis] Analysis complete');

    // Store analysis in database (optional)
    if (supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        await supabase.from('image_analyses').insert({
          user_id: userId,
          image_url: imageUrl,
          analysis: analysis,
          prompt: prompt,
          created_at: new Date().toISOString()
        });
      } catch (dbError) {
        console.error('Error storing image analysis:', dbError);
        // Continue without failing the request
      }
    }

    res.json({
      success: true,
      analysis: analysis,
      imageUrl: imageUrl,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Image analysis error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Get conversation messages
app.get('/api/conversations/:conversationId/messages', verifyJWT, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { since } = req.query;

    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (since) {
      // Accept ISO string or numeric timestamp
      let sinceIso = '';
      if (typeof since === 'string') {
        const num = Number(since);
        if (!Number.isNaN(num) && num > 0) {
          sinceIso = new Date(num).toISOString();
        } else {
          // assume ISO
          sinceIso = new Date(since).toISOString();
        }
      }
      if (sinceIso && !Number.isNaN(Date.parse(sinceIso))) {
        query = query.gt('created_at', sinceIso);
      }
    }

    const { data: messages, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    res.json({ messages });

  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// MailerLite webhook route for event automation
app.post('/api/mailerlite/event', async (req, res) => {
  try {
    const { email, event, properties = {} } = req.body;
    
    if (!email || !event) {
      return res.status(400).json({ 
        error: 'Missing required fields: email and event' 
      });
    }

    console.log(`📧 MailerLite event triggered: ${event} for ${email}`);

    // Get MailerLite API key from environment
    const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
    
    if (!MAILERLITE_API_KEY) {
      console.warn('MailerLite API key not configured');
      return res.status(500).json({ 
        error: 'MailerLite service not configured' 
      });
    }

    // Trigger event via MailerLite v2 API
    const response = await fetch(`https://api.mailerlite.com/api/v2/subscribers/${email}/actions/${event}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
      },
      body: JSON.stringify({
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          source: 'atlas_backend',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `MailerLite API error: ${response.status}`);
    }

    const result = await response.json();
    
    console.log(`✅ MailerLite event ${event} triggered successfully for ${email}`);
    
    res.json({ 
      success: true, 
      message: `Event ${event} triggered successfully`,
      data: result 
    });

  } catch (error) {
    console.error('❌ MailerLite webhook error:', error);
    
    res.status(500).json({ 
      error: 'Failed to trigger MailerLite event',
      details: error.message 
    });
  }
});

// MailerLite subscriber sync route
app.post('/api/mailerlite/subscriber', async (req, res) => {
  try {
    const { email, name, tier, conversations_today, total_conversations } = req.body;
    
    if (!email || !tier) {
      return res.status(400).json({ 
        error: 'Missing required fields: email and tier' 
      });
    }

    console.log(`📧 Syncing subscriber: ${email} (${tier})`);

    const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
    
    if (!MAILERLITE_API_KEY) {
      console.warn('MailerLite API key not configured');
      return res.status(500).json({ 
        error: 'MailerLite service not configured' 
      });
    }

    // Tier group mapping
    const tierGroupMapping = {
      free: 'atlas_free_users',
      core: 'atlas_premium_monthly',
      studio: 'atlas_premium_yearly',
      complete: 'atlas_complete_bundle',
    };

    const targetGroup = tierGroupMapping[tier];
    
    // Create or update subscriber via v2 API
    const subscriberData = {
      email,
      name: name || '',
      fields: {
        tier,
        conversations_today: conversations_today || 0,
        total_conversations: total_conversations || 0,
        last_active: new Date().toISOString(),
        signup_date: new Date().toISOString(),
        subscription_status: 'active',
      },
      resubscribe: true,
    };

    // Check if subscriber exists and create/update
    const createResponse = await fetch('https://api.mailerlite.com/api/v2/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
      },
      body: JSON.stringify(subscriberData),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(`Failed to create/update subscriber: ${createResponse.status} - ${errorData.message || 'Unknown error'}`);
    }

    const result = await createResponse.json();
    console.log(`✅ Subscriber ${email} synced successfully`);

    // Add to appropriate group
    if (targetGroup) {
      try {
        await fetch(`https://api.mailerlite.com/api/v2/groups/${targetGroup}/subscribers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          },
          body: JSON.stringify({ email }),
        });
        console.log(`✅ Subscriber ${email} added to group ${targetGroup}`);
      } catch (groupError) {
        console.warn(`⚠️ Failed to add subscriber to group ${targetGroup}:`, groupError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Subscriber synced successfully',
      data: result 
    });

  } catch (error) {
    console.error('❌ MailerLite subscriber sync error:', error);
    
    res.status(500).json({ 
      error: 'Failed to sync subscriber',
      details: error.message 
    });
  }
});

// User profile endpoint with fallback creation
app.get('/v1/user_profiles/:id', verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('🔍 User profile endpoint called for user:', userId);

    if (!userId) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    // User is already verified by JWT middleware
    const authUser = req.user;
    
    if (!authUser?.id) {
      console.error('No authenticated user found in request');
      return res.status(401).json({ error: 'Missing or invalid authenticated user.' });
    }

    // Then fetch or create user_profile safely
    console.log('🔍 Checking if profile exists for user:', userId);
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    console.log('🔍 Profile fetch result:', { profile, error });

    if (error && error.code === 'PGRST116') {
      // Create fallback profile if missing
      console.log(`Creating fallback profile for user: ${userId}`);
      const profileData = {
        id: userId,
        email: `user-${userId}@atlas.dev`,
        preferences: {},
        subscription_tier: 'free'
      };
      console.log('🔍 Creating profile with data:', profileData);
      
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert([profileData])
        .select()
        .single();

      console.log('🔍 Profile creation result:', { newProfile, createError });

      if (createError) {
        console.error('Error creating user profile:', createError);
        return res.status(500).json({ error: "Failed to create user profile", details: createError });
      }

      console.log(`✅ Created fallback profile for user: ${userId}`);
      return res.status(200).json(newProfile);
    }

    if (error) {
      console.error('Error fetching user profile:', error);
      return res.status(500).json({ error: "Database error", details: error });
    }

    return res.status(200).json(profile);
  } catch (error) {
    console.error('User profile endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user profile endpoint
app.post('/v1/user_profiles', verifyJWT, async (req, res) => {
  try {
    const { user_id } = req.body;
    console.log('🔍 Create user profile endpoint called for user:', user_id);

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // Extract the Bearer token from the Authorization header
    const token = req.headers['authorization']?.replace('Bearer ', '').trim();
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided.' });
    }

    // Pass token explicitly to Supabase client
    const { data: authUser, error: authError } = await supabase.auth.getUser(token);
    
    // Handle Supabase errors or missing user
    if (authError || !authUser?.user?.id) {
      console.error('Supabase getUser error:', authError);
      return res.status(401).json({ error: 'Missing or invalid authenticated user.' });
    }

    const profileData = {
      id: user_id,
      email: `user-${user_id}@atlas.dev`,
      preferences: {},
      subscription_tier: 'free'
    };
    console.log('🔍 Creating profile with data:', profileData);

    const { data: newProfile, error: createError } = await supabase
      .from("user_profiles")
      .insert([profileData])
      .select()
      .single();

    console.log('🔍 Profile creation result:', { newProfile, createError });

    if (createError) {
      console.error('Error creating user profile:', createError);
      return res.status(500).json({ error: "Failed to create user profile", details: createError });
    }

    console.log(`✅ Created user profile for user: ${user_id}`);
    return res.status(201).json(newProfile);
  } catch (error) {
    console.error('Create user profile endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve built Vite frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Serve static files (if any)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback route - serve the frontend app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Atlas Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🏓 Ping test: http://localhost:${PORT}/ping`);
  console.log(`🌐 API status: http://localhost:${PORT}/api/status`);
});
