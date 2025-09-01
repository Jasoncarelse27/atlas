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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || process.env.NOVA_BACKEND_PORT || 8000;

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// External AI API keys
const ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.VITE_CLAUDE_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

// Model mapping by tier
const mapTierToAnthropicModel = (tier) => {
  if (tier === 'studio') return 'claude-3-5-opus';
  return 'claude-3-5-sonnet';
};

// Stream helper: write SSE data chunk
const writeSSE = (res, payload) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

// Stream Anthropic response
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

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => 'Anthropic request failed');
    throw new Error(errText);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let assistantText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') continue;
      try {
        const evt = JSON.parse(dataStr);
        // Content deltas
        if (evt.type === 'content_block_delta' && evt.delta && evt.delta.text) {
          assistantText += evt.delta.text;
          writeSSE(res, { chunk: evt.delta.text });
        }
        // Some events deliver final text
        if (evt.type === 'message_delta' && evt.delta && evt.delta.stop_reason) {
          // no-op here; final handled after loop
        }
      } catch {}
    }
  }

  return assistantText || '(no content)';
}

// Stream Groq response (OpenAI-compatible SSE)
async function streamGroqResponse({ content, res }) {
  if (!GROQ_API_KEY) {
    throw new Error('Missing Groq API key');
  }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      stream: true,
      messages: [{ role: 'user', content }]
    })
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => 'Groq request failed');
    throw new Error(errText);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let assistantText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') continue;
      try {
        const evt = JSON.parse(dataStr);
        const delta = evt.choices?.[0]?.delta?.content;
        if (delta) {
          assistantText += delta;
          writeSSE(res, { chunk: delta });
        }
      } catch {}
    }
  }

  return assistantText || '(no content)';
}

// JWT verification middleware
const verifyJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    res.status(401).json({ error: 'Token verification failed' });
  }
};

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['*']
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://localhost:8081', 'http://127.0.0.1:8081', 'exp://127.0.0.1:19000', 'http://localhost:19006'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint for Railway
app.get('/healthz', (req, res) => {
  res.json({ 
    status: 'healthy',
    backend: "ok",
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
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

// Message endpoint with JWT verification and tier checks
app.post(['/api/message', '/message'], verifyJWT, async (req, res) => {
  try {
    const { message, conversationId, model = 'claude', userTier, userId: userIdBody } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Determine effective tier from DB if not provided
    let effectiveTier = userTier;
    if (!effectiveTier) {
      const { data: subRow } = await supabase
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      effectiveTier = subRow?.tier || 'free';
    }

    // Enforce Free tier daily limit (2 messages/day)
    if (effectiveTier === 'free') {
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
    }

    // Store message in Supabase
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

    const { data: storedMessage, error: insertError } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
      .single();

    if (insertError) {
      console.error('Error storing message:', insertError);
      return res.status(500).json({ error: 'Failed to store message' });
    }

    // Route by tier to determine model/provider
    let routedModel = model;
    if (effectiveTier === 'core') routedModel = 'claude';
    if (effectiveTier === 'studio') routedModel = 'opus';

    // Handle optional mock streaming via SSE
    const wantsStream = req.query.stream === '1' || (req.headers.accept || '').includes('text/event-stream');

    if (wantsStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      let finalText = '';
      try {
        if (routedModel === 'claude' && ANTHROPIC_API_KEY) {
          const anthropicModel = mapTierToAnthropicModel(effectiveTier);
          finalText = await streamAnthropicResponse({ content: message.trim(), model: anthropicModel, res });
        } else if (routedModel === 'groq' && GROQ_API_KEY) {
          finalText = await streamGroqResponse({ content: message.trim(), res });
        } else {
          // Fallback mock streaming
          const chunks = ['Thinking', 'Formulating response', `You said: ${message.trim()}`];
          for (const chunk of chunks) {
            writeSSE(res, { chunk });
            await new Promise(r => setTimeout(r, 250));
          }
          finalText = `You said: ${message.trim()}`;
        }
      } catch (streamErr) {
        console.error('Streaming error:', streamErr);
        finalText = `Sorry, I hit an error generating the response.`;
      }

      // Persist assistant message after stream completes
      const aiResponse = {
        id: uuidv4(),
        conversation_id: messageData.conversation_id,
        user_id: userId,
        role: 'assistant',
        message_type: 'assistant',
        content: { type: 'text', text: finalText },
        model: routedModel,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      const { data: storedResponse, error: responseError } = await supabase
        .from('messages')
        .insert([aiResponse])
        .select()
        .single();
      if (responseError) {
        console.error('Error storing AI response:', responseError);
      }
      writeSSE(res, { done: true, response: storedResponse || aiResponse, conversationId: messageData.conversation_id });
      return res.end();
    }

    // One-shot mode
    let finalText = `(${effectiveTier}) Reply via ${routedModel}: I received your message: "${message}".`;
    try {
      if (routedModel === 'claude' && ANTHROPIC_API_KEY) {
        const anthropicModel = mapTierToAnthropicModel(effectiveTier);
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: anthropicModel,
            max_tokens: 2000,
            messages: [{ role: 'user', content: message.trim() }]
          })
        });
        const data = await r.json();
        finalText = data?.content?.[0]?.text || finalText;
      } else if (routedModel === 'groq' && GROQ_API_KEY) {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [{ role: 'user', content: message.trim() }]
          })
        });
        const data = await r.json();
        finalText = data?.choices?.[0]?.message?.content || finalText;
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
      model: routedModel,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    const { data: storedResponse, error: responseError } = await supabase
      .from('messages')
      .insert([aiResponse])
      .select()
      .single();
    if (responseError) {
      console.error('Error storing AI response:', responseError);
      return res.status(500).json({ error: 'Failed to store AI response' });
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
