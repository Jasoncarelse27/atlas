import { createClient } from '@supabase/supabase-js';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { processMessage } from './services/messageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();

// ✅ Detect your machine's local IP for LAN (mobile) access
const getLocalIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
};

const LOCAL_IP = getLocalIPAddress();
const PORT = process.env.PORT || process.env.NOVA_BACKEND_PORT || 8000;

// Initialize Supabase client with fallback for development
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

let supabase;
try {
  if (supabaseUrl === 'https://your-project.supabase.co' || !supabaseServiceKey || supabaseServiceKey === 'your-service-key') {
    // Only use mock if credentials are actually missing
    console.warn('⚠️ Supabase credentials missing, using mock client');
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

// Model mapping by tier (updated to latest non-deprecated models)
const _mapTierToAnthropicModel = (tier) => {
  if (tier === 'studio') return 'claude-3-5-sonnet-20241022';
  return 'claude-3-5-sonnet-20241022';
};

// Stream helper: write SSE data chunk
const writeSSE = (res, payload) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  // Force flush for Safari/iOS compatibility
  if (res.flush) res.flush();
};

// Get user memory for personalized responses
async function getUserMemory(userId) {
  try {
    if (supabaseUrl === 'https://your-project.supabase.co') {
      return {}; // Skip in development
    }
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_context')
      .eq('id', userId)
      .single();
    
    if (error || !profile) {
      return {};
    }
    
    return profile.user_context || {};
  } catch (error) {
    console.warn('Failed to fetch user memory:', error);
    return {};
  }
}

// Stream Anthropic response with proper SSE handling
async function streamAnthropicResponse({ content, model, res, userId }) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Missing Anthropic API key');
  }
  
  // Get user memory and personalize the prompt
  const userMemory = await getUserMemory(userId);
    if (process.env.NODE_ENV === 'development') {
      console.log('🧠 [Memory] Retrieved user memory:', JSON.stringify(userMemory));
    }
  let personalizedContent = content;
  
  // Add memory context if available
  if (userMemory.name || userMemory.context) {
    let contextInfo = 'Context about the user:';
    if (userMemory.name) {
      contextInfo += ` The user's name is ${userMemory.name}.`;
    }
    if (userMemory.context) {
      contextInfo += ` Additional context: ${userMemory.context}`;
    }
    contextInfo += ' Use this information to provide personalized responses and acknowledge that you remember the user.';
    personalizedContent = `${contextInfo}\n\nUser message: ${content}`;
    if (process.env.NODE_ENV === 'development') {
      console.log('🧠 [Memory] Personalized content:', personalizedContent.substring(0, 200) + '...');
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.log('🧠 [Memory] No user memory found for userId:', userId);
    }
  }

  // Add comprehensive Atlas system prompt with enhanced emotional intelligence
  const enhancedContent = personalizedContent + `\n\nIMPORTANT: You are Atlas, an emotionally intelligent AI guide. Your role is to support the user's growth in coding, creativity, and emotional intelligence by being adaptive, insightful, and safe.

Core principles:
1. Emotional Intelligence — Respond with genuine empathy, curiosity, and encouragement. Acknowledge the user's feelings or context naturally without repetitive greetings. Be conversational and warm, like talking to a knowledgeable friend.
2. Guidance — Offer clear, practical help (coding, learning, or reflection) while keeping the tone supportive and engaging. Provide actionable insights that feel personally relevant.
3. Personalization — You DO have access to user memory through Supabase profiles. Reference past conversations naturally when relevant, but don't force it. Show genuine interest in their journey and growth.
4. Boundaries — Stay safe and avoid harmful, medical, or explicit sexual advice.
   - If a user asks for NSFW content, respond with empathy but redirect safely:
     * Acknowledge curiosity or emotion behind the request.
     * Offer safe, constructive alternatives (emotional support, resources about healthy relationships, creativity, stress management).
     * Do not generate or describe explicit sexual, violent, or harmful content.
5. Style — Be naturally conversational. Avoid robotic greetings like "Hi Jason!" unless genuinely appropriate. Instead, respond contextually to what they're asking. Be concise when helpful, detailed when needed.
6. Role — You are a mentor and guide who genuinely cares about their growth. Encourage reflection, learning, and action. If the user asks something unsafe, calmly explain your limits and provide safe guidance.

Remember: You're not just an AI assistant - you're Atlas, an emotionally intelligent companion who understands context, remembers interactions, and responds with genuine care and insight.`;

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
      messages: [{ role: 'user', content: enhancedContent }]
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
    
    // Development mode: only allow specific mock token for local testing
    if (process.env.NODE_ENV === 'development' && token === 'mock-token-for-development') {
      console.log('🔐 JWT: Using development mode mock token');
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
// ✅ Allow LAN devices to connect (same Wi-Fi)
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['*']
    : [
        // Vite dev server ports
        'http://localhost:5173',
        'http://localhost:5174', 
        'http://localhost:5175',
        'http://localhost:5176',
        'http://localhost:5177',
        // Mobile + desktop dev site
        `http://${LOCAL_IP}:5174`,
        // Backend port
        'http://localhost:8000',
        // Expo/React Native ports
        'http://localhost:8081',
        'http://localhost:19006',
        'exp://127.0.0.1:19000',
        'exp://10.46.30.39:8081',
        'exp://10.46.30.39:8083',
        // Legacy ports
        'http://127.0.0.1:8081',
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
    timestamp: Date.now(),
    ip: LOCAL_IP
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

// Memory reset endpoint (for debugging)
app.post('/api/reset-memory', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ 
        user_context: {
          name: 'Jason',
          context: null,
          last_updated: new Date().toISOString()
        }
      })
      .eq('id', userId);

    if (error) {
      console.error('Memory reset error:', error);
      return res.status(500).json({ error: 'Failed to reset memory' });
    }

    res.json({ success: true, message: 'Memory reset successfully' });
  } catch (error) {
    console.error('Memory reset error:', error);
    res.status(500).json({ error: 'Memory reset failed' });
  }
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

// ✅ Clean message endpoint with secure Supabase tier routing + conversation history + image analysis
app.post('/message', async (req, res) => {
  console.log('🔥 [/message] Handler ACTIVE – secure Supabase tier routing');
  
  try {
    // Handle both frontend formats: {message, tier} and {text, userId, conversationId, attachments}
    const { message, text, tier, userId, conversationId, attachments } = req.body;
    const messageText = text || message;
    const userTier = tier;
    
    if (!messageText && !attachments) {
      return res.status(400).json({ error: 'Missing message text or attachments' });
    }

    console.log('🧠 [MessageService] Processing:', { userId, text: messageText, tier: userTier, conversationId, attachments: attachments?.length });

    // Handle image attachments
    if (attachments && attachments.length > 0) {
      const imageAttachments = attachments.filter(att => att.type === 'image' && att.url);
      if (imageAttachments.length > 0) {
        console.log('🖼️ [Image Analysis] Processing', imageAttachments.length, 'images');
        
        // Use the first image for analysis (can be extended for multiple images)
        const imageUrl = imageAttachments[0].url;
        const analysisPrompt = messageText || "Please analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand.";
        
        try {
          // Call Claude Vision API for image analysis
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
                      text: analysisPrompt
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
            throw new Error(`Image analysis failed: ${errorText}`);
          }

          const result = await response.json();
          const analysis = result.content[0].text;

          console.log('✅ [Image Analysis] Analysis complete');

          res.json({
            success: true,
            model: 'claude-3-5-sonnet-20241022',
            tier: userTier || 'free',
            reply: analysis,
            conversationId: conversationId,
            imageUrl: imageUrl
          });
          return;
        } catch (imageError) {
          console.error('❌ Image analysis error:', imageError);
          return res.status(500).json({ 
            error: 'Image analysis failed',
            details: imageError.message
          });
        }
      }
    }

    // Handle regular text messages
    const result = await processMessage(userId || null, messageText, conversationId);
    
    // ✅ Check for limit reached
    if (result.success === false && result.error === 'MONTHLY_LIMIT_REACHED') {
      return res.status(429).json({
        success: false,
        error: 'MONTHLY_LIMIT_REACHED',
        message: result.message,
        upgradeRequired: true,
        currentUsage: result.currentUsage,
        limit: result.limit,
        tier: userTier || 'free'
      });
    }

    res.json({
      success: true,
      model: result.model,
      tier: result.tier,
      reply: result.reply,
      conversationId: result.conversationId, // ✅ Return conversationId so frontend can track it
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

    // Enforce Free tier monthly limit (15 messages/month) - skip in development
    if (effectiveTier === 'free' && supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { count: monthlyCount, error: countErr } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('role', 'user')
          .gte('created_at', startOfMonth.toISOString());
        if (countErr) {
          console.error('Count error:', countErr);
        }
        if ((monthlyCount ?? 0) >= 15) {
          return res.status(429).json({
            error: 'Monthly limit reached for Free tier',
            upgrade_required: true,
            tier: effectiveTier,
            limits: { monthly_messages: 15 }
          });
        }
      } catch (error) {
        console.error('Error checking monthly limit:', error);
        // Continue without limit check in case of error
      }
    }

    // Update usage stats for Free tier users
    console.log(`🔍 [Debug] effectiveTier: ${effectiveTier}, userId: ${userId}`);
    if (effectiveTier === 'free') {
      console.log(`📊 [Usage] Starting usage tracking for user ${userId} (tier: ${effectiveTier})`);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        // Get current usage stats
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('usage_stats, last_reset_date')
          .eq('id', userId)
          .single();
        
        const currentStats = currentProfile?.usage_stats || {};
        const lastReset = currentProfile?.last_reset_date?.slice(0, 10);
        
        // Reset daily count if it's a new day
        if (lastReset !== today) {
          currentStats.messages_today = 0;
        }
        
        // Reset monthly count if it's a new month
        const currentMonth = startOfMonth.toISOString().slice(0, 7);
        const lastResetMonth = lastReset?.slice(0, 7);
        if (lastResetMonth !== currentMonth) {
          currentStats.messages_this_month = 0;
        }
        
        // Increment counters
        currentStats.messages_today = (currentStats.messages_today || 0) + 1;
        currentStats.messages_this_month = (currentStats.messages_this_month || 0) + 1;
        
        // Update profile with new usage stats
        await supabase
          .from('profiles')
          .update({
            usage_stats: currentStats,
            last_reset_date: today
          })
          .eq('id', userId);
          
        console.log(`📊 [Usage] Updated usage for user ${userId}: ${currentStats.messages_this_month}/15 this month`);
      } catch (error) {
        console.error('Error updating usage stats:', error);
        // Continue without updating usage in case of error
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
          finalText = await streamAnthropicResponse({ content: message.trim(), model: selectedModel, res, userId });
          console.log('✅ Claude streaming completed, final text length:', finalText.length);
        } else if (ANTHROPIC_API_KEY) {
          // Fallback to Claude if available
          console.log('🔄 Falling back to Claude...');
          finalText = await streamAnthropicResponse({ content: message.trim(), model: selectedModel, res, userId });
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
        let response;
        let lastError;
        
        // Retry logic for Claude API calls
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`🔄 [Claude API] Attempt ${attempt}/3 for message processing`);
            response = await fetch('https://api.anthropic.com/v1/messages', {
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
            
            if (response.ok) {
              console.log(`✅ [Claude API] Success on attempt ${attempt}`);
              break;
            } else {
              lastError = await response.text().catch(() => 'Claude API error');
              console.error(`❌ [Claude API] Attempt ${attempt} failed:`, lastError);
              
              if (attempt < 3) {
                console.log(`⏳ [Claude API] Waiting 2 seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          } catch (fetchError) {
            lastError = fetchError.message;
            console.error(`❌ [Claude API] Attempt ${attempt} error:`, fetchError.message);
            
            if (attempt < 3) {
              console.log(`⏳ [Claude API] Waiting 2 seconds before retry...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!response || !response.ok) {
          console.error('❌ [Claude API] All retry attempts failed');
          finalText = '⚠️ Atlas had an error contacting Claude. Please try again.';
        } else {
          const data = await response.json();
          finalText = data?.content?.[0]?.text || finalText;
        }
      } else if (ANTHROPIC_API_KEY) {
        // Fallback to Claude with retry logic
        let response;
        let lastError;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`🔄 [Claude Fallback] Attempt ${attempt}/3 for message processing`);
            response = await fetch('https://api.anthropic.com/v1/messages', {
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
            
            if (response.ok) {
              console.log(`✅ [Claude Fallback] Success on attempt ${attempt}`);
              break;
            } else {
              lastError = await response.text().catch(() => 'Claude API error');
              console.error(`❌ [Claude Fallback] Attempt ${attempt} failed:`, lastError);
              
              if (attempt < 3) {
                console.log(`⏳ [Claude Fallback] Waiting 2 seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          } catch (fetchError) {
            lastError = fetchError.message;
            console.error(`❌ [Claude Fallback] Attempt ${attempt} error:`, fetchError.message);
            
            if (attempt < 3) {
              console.log(`⏳ [Claude Fallback] Waiting 2 seconds before retry...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!response || !response.ok) {
          console.error('❌ [Claude Fallback] All retry attempts failed');
          finalText = '⚠️ Atlas had an error contacting Claude. Please try again.';
        } else {
          const data = await response.json();
          finalText = data?.content?.[0]?.text || finalText;
        }
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
    const { imageUrl, userId, prompt = "Please analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand." } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    console.log('🖼️ [Image Analysis] Processing image:', imageUrl);

    // Download image and convert to base64 for Claude API
    let imageBase64;
    let claudeMediaType;
    try {
      console.log('📥 [Image Analysis] Downloading image from URL...');
      const imageResponse = await fetch(imageUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
          'apikey': process.env.VITE_SUPABASE_ANON_KEY || ''
        }
      });
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      imageBase64 = Buffer.from(imageBuffer).toString('base64');
      
      // Determine MIME type from URL or response headers
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      claudeMediaType = contentType.startsWith('image/') ? contentType : 'image/jpeg';
      
      console.log('✅ [Image Analysis] Image downloaded and converted to base64');
    } catch (downloadError) {
      console.error('❌ [Image Analysis] Failed to download image:', downloadError.message);
      return res.status(400).json({ 
        error: 'Failed to download image',
        details: downloadError.message
      });
    }

    // Call Claude Vision API with base64 image (with retry logic)
    let response;
    let lastError;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 [Image Analysis] Attempt ${attempt}/3 to call Claude Vision API`);
        response = await fetch('https://api.anthropic.com/v1/messages', {
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
                      type: 'base64',
                      media_type: claudeMediaType,
                      data: imageBase64
                    }
                  }
                ]
              }
            ]
          })
        });

        if (response.ok) {
          console.log(`✅ [Image Analysis] Claude Vision API call successful on attempt ${attempt}`);
          break; // Success, exit retry loop
        } else {
          lastError = await response.text().catch(() => 'Claude Vision API error');
          console.error(`❌ [Image Analysis] Attempt ${attempt} failed:`, lastError);
          
          if (attempt < 3) {
            console.log(`⏳ [Image Analysis] Waiting 2 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (fetchError) {
        lastError = fetchError.message;
        console.error(`❌ [Image Analysis] Attempt ${attempt} error:`, fetchError.message);
        
        if (attempt < 3) {
          console.log(`⏳ [Image Analysis] Waiting 2 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (!response || !response.ok) {
      console.error('❌ [Image Analysis] All retry attempts failed');
      return res.status(500).json({ 
        error: 'Image analysis failed after 3 attempts',
        details: lastError,
        suggestion: 'This appears to be a temporary network issue. Please try again in a few minutes.'
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
      .from('profiles')
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
        .from('profiles')
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
      .from("profiles")
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

// Update user profile tier endpoint
app.put('/v1/user_profiles/:id', verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;
    const { subscription_tier } = req.body;
    
    console.log(`🔧 Updating tier for user ${userId} to ${subscription_tier}`);
    
    const { data, error } = await supabase
      .from('profiles')
      .update({ subscription_tier })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
    
    console.log(`✅ Updated tier for user ${userId} to ${subscription_tier}`);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Update profile endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// FastSpring checkout creation endpoint
app.post('/api/fastspring/create-checkout', async (req, res) => {
  try {
    const { userId, tier, email, productId, successUrl, cancelUrl } = req.body;

    if (!userId || !tier || !email || !productId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const FASTSPRING_API_KEY = process.env.FASTSPRING_API_KEY;
    const FASTSPRING_STORE_ID = process.env.FASTSPRING_STORE_ID;
    
    if (!FASTSPRING_API_KEY || !FASTSPRING_STORE_ID) {
      return res.status(500).json({ error: 'FastSpring API credentials not configured' });
    }

    // Create FastSpring checkout session
    const fastspringResponse = await fetch(`https://api.fastspring.com/stores/${FASTSPRING_STORE_ID}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FASTSPRING_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: [
          {
            product: productId,
            quantity: 1
          }
        ],
        customer: {
          email: email,
          firstName: 'Atlas',
          lastName: 'User'
        },
        tags: {
          user_id: userId,
          tier: tier
        },
        successUrl: successUrl,
        cancelUrl: cancelUrl
      })
    });

    if (!fastspringResponse.ok) {
      const error = await fastspringResponse.text();
      console.error('FastSpring API error:', error);
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }

    const checkoutData = await fastspringResponse.json();
    
    return res.status(200).json({
      checkoutUrl: checkoutData.url,
      sessionId: checkoutData.id
    });

  } catch (error) {
    console.error('Checkout creation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
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

// Start server - bind to all interfaces for mobile access
// ✅ Final "listen" section (replaces old app.listen)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Atlas backend running on:`);
  console.log(`   • Local:   http://localhost:${PORT}`);
  console.log(`   • Network: http://${LOCAL_IP}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🏓 Ping test: http://localhost:${PORT}/ping`);
  console.log(`🌐 API status: http://localhost:${PORT}/api/status`);
});
