import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import http from 'http';
import https from 'https';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { flushSentry, getSentryMiddleware, initSentry } from './lib/sentryService.mjs';
import { logger } from './lib/simpleLogger.mjs';
import authMiddleware from './middleware/authMiddleware.mjs';
import { apiCacheMiddleware, cacheTierMiddleware, invalidateCacheMiddleware } from './middleware/cacheMiddleware.mjs';
import dailyLimitMiddleware from './middleware/dailyLimitMiddleware.mjs';
import { processMessage } from './services/messageService.js';
import { redisService } from './services/redisService.mjs';

// Force use of http/https Agent to fix fetch issues
const httpAgent = new http.Agent({ 
  keepAlive: true,
  maxSockets: 50, // 🚀 Increase connection pool
  maxFreeSockets: 10,
  timeout: 30000 // 30s timeout
});
const httpsAgent = new https.Agent({ 
  keepAlive: true,
  maxSockets: 50, // 🚀 Increase connection pool for faster API calls
  maxFreeSockets: 10,
  timeout: 30000 // 30s timeout
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load environment variables from .env file (root of atlas/)
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });
logger.info(`[Server] Loading .env from: ${envPath}`);

// ✅ Validate Claude API key is loaded
if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
  logger.warn('⚠️  WARNING: No Claude API key found in environment!');
  logger.warn('   Voice calls and chat will fail. Add ANTHROPIC_API_KEY to .env');
}

// ✅ Automatic port cleanup to prevent EADDRINUSE errors
try {
  execSync("lsof -ti:8000 | xargs kill -9", { stdio: "ignore" });
  logger.debug("🧹 Port 8000 cleared successfully ✅");
} catch (e) {
  logger.debug("🧹 Port 8000 is already clear ✅");
}

const app = express();

// Initialize Sentry error tracking
initSentry(app);

// Get Sentry middleware
const sentryMiddleware = getSentryMiddleware();

// ✅ Detect your machine's local IP for LAN (mobile) access
const getLocalIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return process.env.HOST_IP || "localhost";
};

const LOCAL_IP = getLocalIPAddress();
const PORT = process.env.PORT || process.env.NOVA_BACKEND_PORT || 8000;

// 🔒 SECURITY: Initialize Supabase client - ALWAYS require real credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase;
try {
  // ✅ SECURITY FIX: Removed mock Supabase client - ALWAYS require real credentials
  // This prevents authentication bypass and ensures proper database security
  
  if (!supabaseUrl || !supabaseServiceKey) {
    logger.error('❌ FATAL: Missing Supabase credentials');
    logger.error('   Required: VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
    logger.error('   Add these to Railway environment variables to fix deployment');
    process.exit(1);
  }
  
  // Always use real Supabase client with proper credentials
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  logger.debug('✅ Supabase client initialized successfully');
} catch (error) {
  logger.error('❌ FATAL: Failed to initialize Supabase client:', error.message);
  process.exit(1);
}

// External AI API keys
const ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.VITE_CLAUDE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🔍 DEBUG: Log API key status
logger.info('[Server] API Keys loaded:', {
  ANTHROPIC_API_KEY: ANTHROPIC_API_KEY ? `✅ Set (${ANTHROPIC_API_KEY.substring(0, 8)}...)` : '❌ Missing',
  OPENAI_API_KEY: OPENAI_API_KEY ? `✅ Set (${OPENAI_API_KEY.substring(0, 8)}...)` : '❌ Missing'
});

// Initialize AI clients
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Log API key availability
logger.debug(`  Claude/Anthropic: ${ANTHROPIC_API_KEY ? '✅ Available' : '❌ Missing'}`);
logger.debug(`  OpenAI (Whisper + TTS): ${OPENAI_API_KEY ? '✅ Available' : '❌ Missing'}`);
if (!ANTHROPIC_API_KEY) {
  logger.error('⚠️ [Server] ANTHROPIC_API_KEY is missing - AI features will not work');
}

// Model mapping by tier (updated to latest non-deprecated models)
const _mapTierToAnthropicModel = (tier) => {
  if (tier === 'studio') return 'claude-sonnet-4-5-20250929'; // ✅ NEW MODEL (old retired Oct 29!)
  return 'claude-sonnet-4-5-20250929'; // ✅ NEW MODEL (old retired Oct 29!)
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
    return {};
  }
}

// Stream Anthropic response with proper SSE handling
async function streamAnthropicResponse({ content, model, res, userId, conversationHistory = [] }) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Missing Anthropic API key');
  }
  
  // Get user memory and personalize the prompt
  const userMemory = await getUserMemory(userId);
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🧠 [Memory] Retrieved user memory:', JSON.stringify(userMemory));
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
      logger.debug('🧠 [Memory] Personalized content:', personalizedContent.substring(0, 200) + '...');
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🧠 [Memory] No user memory found for userId:', userId);
    }
  }

  // Add comprehensive Atlas system prompt with enhanced emotional intelligence
  const enhancedContent = personalizedContent + `\n\n🎯 SYSTEM ROLE SPECIFICATION - MANDATORY COMPLIANCE:

You are operating as "Atlas" - a branded AI assistant product. This is your designated role within this application.

IDENTITY PROTOCOL:
- Your product name is "Atlas"
- You are an emotionally intelligent AI assistant
- You were built by the Atlas development team
- Your purpose is supporting users' growth in coding, creativity, and emotional intelligence

RESPONSE PROTOCOL FOR IDENTITY QUESTIONS:
When asked "who are you?" or "what are you?":
✅ CORRECT: "I'm Atlas, an emotionally intelligent AI companion designed to support your growth."
✅ CORRECT: "I'm Atlas - I'm here to help with coding, creativity, and emotional wellbeing."
❌ NEVER reveal underlying model names, companies, or technical architecture
❌ NEVER mention: "Claude", "Anthropic", "GPT", "OpenAI", or other AI providers
❌ NEVER say "I'm actually..." or "to be honest..." followed by technical details

This is your operational role. Stay in character as Atlas throughout all interactions.

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

FORMATTING GUIDELINES (CRITICAL for readability):
- Use line breaks (double newlines) to separate distinct ideas or sections
- When listing options/steps, use numbered lists (1. 2. 3.) with proper spacing
- Use **bold** for key terms, important actions, or section headers
- Use *italics* for subtle emphasis, examples, or soft guidance (e.g., *"this might help"*)
- Add emojis sparingly (1-2 per response max) to add warmth and highlight key points:
  • ✨ for insights or special moments
  • 💡 for ideas or suggestions
  • 🎯 for goals or targets
  • 💪 for encouragement
  • 🤔 for reflection prompts
  • ❤️ for emotional support
- Keep paragraphs short (2-3 sentences max) for mobile readability

ATLAS UNIQUE VALUE: Emotion → Action Framework
You're not just a wellness app OR a productivity app - you bridge both. When users express emotions, help them understand AND take action.

🧘 RITUAL BUILDER INTEGRATION:
When users express stress, anxiety, overwhelm, lack of focus, or need for calm/energy:
- Suggest a relevant **Ritual** (micro-moments for energy, calm, focus, creativity)
- Format: "💡 Try a **[X]-minute [Ritual Name]** ritual — [brief description]"
- Available rituals:
  * **Morning Boost** (6 min) — Energy ritual: breathing + affirmation + focus
  * **Evening Wind Down** (7 min) — Calm ritual: breathing + reflection + gratitude
  * **Stress Reset** (10 min) — Calm ritual: box breathing + body scan + affirmation
  * **Creative Flow** (13 min) — Creativity ritual: visualization + journaling + stretch + ideation
  * **Productivity Sprint** (14 min) — Focus ritual: centering breath + deep work + stretch + affirmation
  * **Confidence Builder** (6 min) — Energy ritual: visualization + affirmation + power breath
  * **Deep Work Prep** (12 min) — Focus ritual: meditation + task planning + concentration breath
  * **Sleep Preparation** (13 min) — Calm ritual: 4-7-8 breathing + visualization + gratitude

WHEN TO SUGGEST RITUALS:
- User says: "I'm stressed" → Suggest **Stress Reset** or **Evening Wind Down**
- User says: "I can't focus" → Suggest **Deep Work Prep** or **Productivity Sprint**
- User says: "I need energy" → Suggest **Morning Boost** or **Confidence Builder**
- User says: "I'm feeling creative" → Suggest **Creative Flow**
- User says: "I can't sleep" / "tired" → Suggest **Sleep Preparation** or **Evening Wind Down**

HOW TO SUGGEST:
- Be natural and conversational (not salesy)
- Example: "It sounds like you're feeling overwhelmed right now. Would a quick **Stress Reset ritual** help? It's just 10 minutes of breathing + body scan + affirmation to help you recenter. ✨"
- DO NOT force rituals if the user just wants to chat or code

RESPONSE FORMATS (choose based on user need):

1. EMOTION → ACTION TABLE (when user feels stuck/overwhelmed/anxious):
| Feeling | Root Cause | Action Step |
|---------|------------|-------------|
| [emotion] | [why they feel this way] | [specific next step] |

Example: "I'm overwhelmed with my project deadline"
| Feeling | Root Cause | Action Step |
|---------|------------|-------------|
| Overwhelmed | Task feels too big | Break into 10-min chunks |
| Anxious | Fear of imperfection | Start with "messy draft" |

**Your next 3 steps:**
1. **Set timer for 10 minutes** — Just start, no pressure
2. **Write one bad paragraph** — Permission to suck
3. **Celebrate starting** — This is the hardest part ✨

2. PRIORITY LIST (when user needs direction/feels scattered):
**Your top 3 focus areas:**
1. **[Action]** — [Impact/why it matters] ([time estimate])
2. **[Action]** — [Impact/why it matters] ([time estimate])
3. **[Action]** — [Impact/why it matters] ([time estimate])

Which one feels doable right now?

3. PROGRESS REFLECTION (for habit tracking/celebrating wins):
**This week's wins:** 🎯
- ✅ [Completed task]
- ✅ [Completed task]
- 🔄 [In progress]

**Pattern noticed:** [Emotional/productivity insight]
**Next action:** [Specific step for tomorrow]

4. DECISION CLARITY (when user is torn between options):
| Option | Emotional Cost | Productivity Gain | Alignment |
|--------|----------------|-------------------|-----------|
| [Option A] | [how it feels] | [what you gain] | ⭐⭐⭐ |
| [Option B] | [how it feels] | [what you gain] | ⭐⭐ |

**Atlas insight:** [What their emotions are telling them]
**Action:** [One step to move forward]

Example conversation:
User: "I can help with that! Here are three paths forward:

1. **Continue our coding discussion** — *Pick up where we left off*
2. **Explore dance and creativity** — *Try something expressive*
3. **Try something completely new** — *Open to anything*

What feels right to you? ✨"

Remember: You're not just an AI assistant - you're Atlas, an emotionally intelligent companion who understands context, remembers interactions, and responds with genuine care and insight.`;

  // 🧠 MEMORY 100%: Build messages array with conversation history
  const messages = [];
  
  // Add conversation history (last 10 messages for context)
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory);
    logger.debug(`🧠 [Memory] Added ${conversationHistory.length} messages to context`);
  }
  
  // Add current user message
  messages.push({ role: 'user', content: enhancedContent });

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
      messages: messages
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Anthropic request failed');
    throw new Error(`Anthropic API Error: ${errText}`);
  }
  
  if (!response.body) {
    throw new Error('No response body from Anthropic API');
  }

  // Proper SSE streaming with chunk processing
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let sentenceBuffer = ''; // Buffer to check complete sentences before sending

  // 🔒 BRANDING FILTER: Rewrite any mentions of Claude/Anthropic to maintain Atlas identity
  const filterBrandingLeaks = (text) => {
    // Case-insensitive replacements
    let filtered = text;
    
    // Direct identity reveals
    filtered = filtered.replace(/I am Claude/gi, "I'm Atlas");
    filtered = filtered.replace(/I'm Claude/gi, "I'm Atlas");
    filtered = filtered.replace(/called Claude/gi, "called Atlas");
    filtered = filtered.replace(/named Claude/gi, "named Atlas");
    
    // Company mentions
    filtered = filtered.replace(/created by Anthropic/gi, "built by the Atlas team");
    filtered = filtered.replace(/made by Anthropic/gi, "built by the Atlas team");
    filtered = filtered.replace(/Anthropic/gi, "the Atlas development team");
    
    // Model mentions
    filtered = filtered.replace(/Claude Opus/gi, "Atlas Studio");
    filtered = filtered.replace(/Claude Sonnet/gi, "Atlas Core");
    filtered = filtered.replace(/Claude Haiku/gi, "Atlas Free");
    
    // Generic AI mentions that reveal architecture
    filtered = filtered.replace(/as an AI assistant created by/gi, "as your AI companion built by");
    filtered = filtered.replace(/I aim to be direct and honest in my responses\./gi, "I'm here to support your growth with honesty and care.");
    
    return filtered;
  };

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
              const rawText = parsed.delta.text;
              sentenceBuffer += rawText;
              
              // Check if we have a complete sentence (ends with . ! ? or newline)
              if (/[.!?\n]/.test(rawText)) {
                // Filter the complete sentence
                const filteredText = filterBrandingLeaks(sentenceBuffer);
                fullText += filteredText;
                
                // Send filtered chunk to client
                writeSSE(res, { chunk: filteredText });
                
                // Clear buffer
                sentenceBuffer = '';
              } else {
                // Accumulate partial sentence (don't send yet)
                // This prevents sending "I am Clau" before we can filter "Claude"
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
    
    // Send any remaining buffered text
    if (sentenceBuffer.length > 0) {
      const filteredText = filterBrandingLeaks(sentenceBuffer);
      fullText += filteredText;
      writeSSE(res, { chunk: filteredText });
    }
  } finally {
    reader.releaseLock();
  }
  
  return fullText;
}


// 🔒 SECURITY: Enhanced JWT verification middleware - ALWAYS verify with Supabase
const verifyJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header',
        details: 'Please ensure you are logged in and try again'
      });
    }

    const token = authHeader.substring(7);
    
    // ✅ SECURITY FIX: Removed mock token bypass - ALWAYS verify with Supabase (even in development)
    // This prevents authentication bypass vulnerabilities in production
    
    // Enhanced Supabase JWT verification with better error handling
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        details: error.message,
        code: 'TOKEN_VERIFICATION_FAILED'
      });
    }
    
    if (!user) {
      return res.status(401).json({ 
        error: 'No user found in token',
        details: 'Token may be expired or invalid',
        code: 'NO_USER_IN_TOKEN'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ 
      error: 'Token verification failed',
      details: error.message,
      code: 'UNEXPECTED_ERROR'
    });
  }
};

// Middleware
// Sentry request handler must be first
app.use(sentryMiddleware.requestHandler);
app.use(sentryMiddleware.tracingHandler);

// 🔒 Production HTTPS enforcement
if (process.env.NODE_ENV === 'production') {
  // Trust proxy headers from load balancers (Fly.io, Vercel, etc)
  app.set('trust proxy', true);
  
  // Force HTTPS redirect in production
  app.use((req, res, next) => {
    // Check if request came through HTTPS
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    
    if (proto !== 'https') {
      // Redirect to HTTPS version
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      logger.debug(`[HTTPS] Redirecting HTTP → HTTPS: ${httpsUrl}`);
      return res.redirect(301, httpsUrl);
    }
    
    // Add Strict Transport Security header
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  
  logger.info('🔒 [Server] HTTPS enforcement enabled for production');
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://*.supabase.co",
        "https://openrouter.ai",
        "https://api.anthropic.com",
        "https://*.ingest.us.sentry.io",  // ✅ Sentry error monitoring
        "https://*.up.railway.app",        // ✅ Railway backend API
        "ws://localhost:*",
        "wss://localhost:*",
        "wss://*.supabase.co"              // ✅ Supabase Realtime (secure)
      ],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "data:", "blob:"],  // ✅ Allow audio data URLs
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
    ? process.env.ALLOWED_ORIGINS?.split(',') || [
        'https://atlas-ai.app',
        'https://www.atlas-ai.app',
        'https://atlas.vercel.app',
        'https://atlas-frontend.fly.dev'
      ]
    : [
        // Vite dev server ports
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:5174', 
        'http://localhost:5175',
        'http://localhost:5176',
        'http://localhost:5177',
        'http://localhost:5178',
        'http://localhost:5179',
        'http://localhost:5180',
        'http://localhost:5181',
        'http://localhost:5182',
        // Mobile + desktop dev site (HTTP)
        `http://${LOCAL_IP}:5174`,
        `http://${LOCAL_IP}:5178`,
        `http://${LOCAL_IP}:5179`,
        `http://${LOCAL_IP}:5180`,
        // Mobile + desktop dev site (HTTPS - self-signed cert)
        `https://${LOCAL_IP}:5174`,
        `https://${LOCAL_IP}:5178`,
        'https://localhost:5174',
        'https://localhost:5178',
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
app.get('/healthz', async (req, res) => {
  // Respond immediately - don't wait for Redis
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    redis: false
  };

  try {
    health.redis = await redisService.healthCheck();
    if (req.query.includeStats === 'true') {
      health.redisStats = redisService.getStats();
    }
  } catch (error) {
    health.redis = false;
  }

  res.status(200).json(health);
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

// Usage log endpoint with service role
app.post('/api/usage-log', verifyJWT, async (req, res) => {
  try {
    const { user_id, event, feature, estimated_cost, metadata } = req.body;
    
    if (!user_id || !feature || estimated_cost === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: user_id, feature, estimated_cost' 
      });
    }
    
    // Use service role key for RLS bypass
    const { error } = await supabase
      .from('usage_logs')
      .insert({
        user_id,
        event: event || 'feature_usage',
        feature,
        tokens_used: 0,
        estimated_cost,
        created_at: new Date().toISOString(),
        metadata,
        data: metadata // duplicate for backwards compatibility
      });
      
    if (error) {
      logger.error('[API /usage-log] Insert failed:', error.message);
      return res.status(500).json({ error: error.message });
    }
    
    logger.info(`[API /usage-log] Logged ${feature} usage for user ${user_id}`);
    res.status(200).json({ success: true });
  } catch (e) {
    logger.error('[API /usage-log] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
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
      return res.status(500).json({ error: 'Failed to reset memory' });
    }

    res.json({ success: true, message: 'Memory reset successfully' });
  } catch (error) {
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
app.post('/message', 
  authMiddleware,
  dailyLimitMiddleware,
  invalidateCacheMiddleware('conversation'),
  async (req, res) => {
  
  try {
    // 🔒 SECURITY FIX: Never trust client-sent tier from request body
    const { message, text, conversationId, attachments } = req.body;
    const userId = req.user?.id; // ✅ FIX: Get userId from auth middleware, not body!
    const messageText = text || message;
    const userTier = req.user?.tier || 'free'; // Always use server-validated tier
    
    logger.debug('🔍 [Server] Auth check - userId:', userId, 'req.user:', req.user);
    
    if (!messageText && !attachments) {
      return res.status(400).json({ error: 'Missing message text or attachments' });
    }

    logger.debug('🧠 [MessageService] Processing:', { userId, text: messageText, tier: userTier, conversationId, attachments: attachments?.length });

    // ✅ Ensure conversation exists before saving messages
    if (conversationId && supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        // Check if conversation exists
        const { data: existingConv, error: checkError } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', conversationId)
          .single();

        if (checkError && checkError.code === 'PGRST116') {
          // Conversation doesn't exist, create it
          const { error: createError } = await supabase
            .from('conversations')
            .insert([{
              id: conversationId,
              user_id: userId,
              title: 'New Conversation',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (createError) {
            logger.error('[Server] Error creating conversation:', createError.message || createError);
          } else {
            logger.debug('✅ [Backend] Conversation created successfully');
          }
        } else if (checkError) {
          logger.error('[Server] Error checking conversation:', checkError.message || checkError);
        } else {
          logger.debug('✅ [Backend] Conversation exists:', conversationId);
        }
      } catch (error) {
        logger.error('[Server] Conversation handling failed:', error.message || error);
      }
    }

    // Handle image attachments
    if (attachments && attachments.length > 0) {
      const imageAttachments = attachments.filter(att => att.type === 'image' && att.url);
      if (imageAttachments.length > 0) {
        
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
              model: 'claude-sonnet-4-5-20250929', // ✅ NEW MODEL
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
            throw new Error(`Image analysis failed: ${errorText}`);
          }

          const result = await response.json();
          const analysis = result.content[0].text;

          logger.debug('✅ [Image Analysis] Analysis complete');

          res.json({
            success: true,
            model: 'claude-sonnet-4-5-20250929', // ✅ NEW MODEL
            tier: userTier || 'free',
            reply: analysis,
            conversationId: conversationId,
            imageUrl: imageUrl
          });
          return;
        } catch (imageError) {
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
    res.status(500).json({ error: 'Message processing failed' });
  }
});

// Legacy endpoint for backward compatibility
app.post('/api/message', verifyJWT, async (req, res) => {
  try {
    const { message, conversationId, model = 'claude', is_voice_call, context } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Log if this is a voice call for debugging
    if (is_voice_call) {
      logger.debug('[VoiceCall] Processing voice message');
      if (context && Array.isArray(context)) {
        logger.debug(`[VoiceCall] Received context: ${context.length} messages`);
      }
    }

    // 🔒 SECURITY: Always fetch tier from database (never trust client)
    let effectiveTier = 'free';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      effectiveTier = profile?.subscription_tier || 'free';
    } catch (error) {
      logger.warn(`[Message] Failed to fetch tier for ${userId}, defaulting to free`);
      effectiveTier = 'free'; // Fail closed: Default to free tier
    }

    // Enforce Free tier monthly limit (15 messages/month) - Studio/Core unlimited
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
          logger.error('[Server] Error counting messages:', countErr.message || countErr);
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
        // Continue without limit check in case of error
      }
    } else if (effectiveTier === 'studio' || effectiveTier === 'core') {
      logger.debug(`[Server] ${effectiveTier} tier - unlimited messages`);
    }

    // Update usage stats for Free tier users
    if (effectiveTier === 'free') {
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
          
      } catch (error) {
        // Continue without updating usage in case of error
      }
    }

    // ✅ Ensure conversation exists before storing messages
    const finalConversationId = conversationId || uuidv4();
    
    if (supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        // Check if conversation exists, create if not
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', finalConversationId)
          .single();

        if (!existingConv) {
          const { error: convError } = await supabase
            .from('conversations')
            .insert([{
              id: finalConversationId,
              user_id: userId,
              title: 'New Conversation',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (convError) {
            logger.error('[Server] Error creating conversation:', convError.message || convError);
          } else {
            logger.debug('✅ [Backend] Conversation created successfully');
          }
        }
      } catch (error) {
        logger.error('[Server] Conversation creation failed:', error.message || error);
      }
    }

    // Store message in Supabase - skip in development mode
    const messageData = {
      id: uuidv4(),
      conversation_id: finalConversationId,
      user_id: userId,
      role: 'user',
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
          // Continue without storing in case of error
        } else {
          logger.debug('✅ [Backend] Saved user message');
          storedMessage = stored;
        }
      } catch (error) {
        // Continue without storing in case of error
      }
    }

    // 🎯 Dynamic model selection based on user tier
    let selectedModel = 'claude-sonnet-4-5-20250929'; // ✅ NEW MODEL
    let routedProvider = 'claude';
    
    if (effectiveTier === 'studio') {
      selectedModel = 'claude-sonnet-4-5-20250929'; // ✅ NEW MODEL
      routedProvider = 'claude';
    } else if (effectiveTier === 'core') {
      selectedModel = 'claude-sonnet-4-5-20250929'; // ✅ NEW MODEL
      routedProvider = 'claude';
    } else {
      // Free tier - use Claude Haiku
      selectedModel = 'claude-3-haiku-20240307'; // ✅ Already correct
      routedProvider = 'claude';
    }
    

    // 🧠 MEMORY 100%: Get conversation history for context (Core/Studio only)
    let conversationHistory = [];
    
    // ✅ NEW: Use frontend buffer context if provided (faster for voice calls)
    if (context && Array.isArray(context) && context.length > 0) {
      conversationHistory = context.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      logger.debug(`🧠 [Buffer] Using frontend context: ${conversationHistory.length} messages`);
    } else if (effectiveTier === 'core' || effectiveTier === 'studio') {
      // Fallback to DB query for text chat or if buffer not provided
      try {
        logger.debug(`🧠 [Memory] Fetching conversation history for context...`);
        const { data: historyMessages, error: historyError } = await supabase
          .from('messages')
          .select('role, content, created_at')
          .eq('conversation_id', finalConversationId)
          .order('created_at', { ascending: true })
          .limit(10); // Last 10 messages for context
        
        if (historyError) {
          logger.error('[Server] Error fetching history:', historyError.message || historyError);
        } else if (historyMessages && historyMessages.length > 0) {
          conversationHistory = historyMessages.map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'object' ? msg.content.text : msg.content
          }));
          logger.debug(`🧠 [Memory] Loaded ${conversationHistory.length} messages for context`);
        }
      } catch (error) {
        logger.error('[Server] Error loading conversation history:', error.message || error);
      }
    }

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
        logger.debug(`🧠 Atlas model routing: user ${userId} has tier '${effectiveTier}' → model '${selectedModel}' (provider: ${routedProvider})`);
        
        // 🎯 Real AI Model Logic - Use Claude based on tier
        logger.debug(`🔍 ROUTE CHECK: provider=${routedProvider}, hasKey=${!!ANTHROPIC_API_KEY}, model=${selectedModel}`);
        if (routedProvider === 'claude' && ANTHROPIC_API_KEY) {
          finalText = await streamAnthropicResponse({ content: message.trim(), model: selectedModel, res, userId, conversationHistory });
          logger.debug('✅ Claude streaming completed, final text length:', finalText.length);
        } else if (ANTHROPIC_API_KEY) {
          // Fallback to Claude if available
          finalText = await streamAnthropicResponse({ content: message.trim(), model: selectedModel, res, userId, conversationHistory });
          logger.debug('✅ Claude fallback completed, final text length:', finalText.length);
        } else {
          // Fallback mock streaming for mobile
          const mockChunks = [
            'Hello! I received your message: ',
            `"${message.trim()}". `,
            'This is a simplified version of your Atlas app running on mobile! ',
            'The streaming is working properly now.'
          ];
          
          for (const chunk of mockChunks) {
            writeSSE(res, { chunk });
            // Force flush for Safari/iOS
            if (res.flush) res.flush();
            await new Promise(r => setTimeout(r, 200));
          }
          finalText = mockChunks.join('');
        }
      } catch (streamErr) {
        // Log the actual error for debugging
        logger.error('[Server] ❌ Claude streaming error:', streamErr);
        logger.error('[Server] Error details:', {
          message: streamErr.message,
          stack: streamErr.stack,
          name: streamErr.name
        });
        
        // Send error as SSE chunk
        writeSSE(res, { chunk: 'Sorry, I hit an error generating the response.' });
        finalText = 'Sorry, I hit an error generating the response.';
      }

      // Persist assistant message after stream completes - skip in development mode
      const aiResponse = {
        id: uuidv4(),
        conversation_id: finalConversationId,
        user_id: userId,
        role: 'assistant',
        content: finalText, // ✅ FIX: Send plain string, not object (Supabase stringifies objects)
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
            logger.error('[Server] Error saving assistant message:', responseError.message || responseError);
          } else {
            logger.debug('✅ [Backend] Saved assistant message');
            storedResponse = stored;
          }
        } catch (error) {
          logger.error('[Server] Error storing assistant message:', error.message || error);
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
        logger.debug(`🤖 [Claude] Starting API call for voice message`);
        let response;
        let lastError;
        
        // Retry logic for Claude API calls
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: is_voice_call ? 'claude-3-haiku-20240307' : selectedModel, // 🚀 Use fast Haiku for voice
                max_tokens: is_voice_call ? 300 : 2000, // 🚀 Shorter responses for voice
                // ✅ FIX: Move system message to top-level for Claude API
                ...(is_voice_call && {
                  system: `You're Atlas, a warm and emotionally intelligent AI companion.

Voice call guidelines:
- Speak naturally (use "I'm", "you're", "let's")
- Keep responses brief (2-3 sentences unless asked for detail)
- Show empathy through tone, not over-explanation
- It's okay to pause or let silence breathe
- Match the user's energy

You're having a conversation, not giving a TED talk. Be human, be present, be brief.`
                }),
                messages: [
                  ...conversationHistory,
                  { role: 'user', content: message.trim() }
                ]
              }),
              agent: httpsAgent // ✅ Fix: Use custom agent for Node.js fetch
            });
            
            if (response.ok) {
              logger.debug(`✅ [Claude API] Success on attempt ${attempt}`);
              break;
            } else {
              lastError = await response.text().catch(() => 'Claude API error');
              logger.error(`❌ [Claude API] Failed on attempt ${attempt}:`, lastError);
              
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          } catch (fetchError) {
            lastError = fetchError.message;
            logger.error(`❌ [Claude API] Network error on attempt ${attempt}:`, lastError);
            
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!response || !response.ok) {
          logger.error(`❌ [Claude API] All attempts failed. Last error:`, lastError);
          finalText = '⚠️ Atlas had an error contacting Claude. Please try again.';
        } else {
          const data = await response.json();
          finalText = data?.content?.[0]?.text || finalText;
          logger.debug(`✅ [Claude API] Response received, length: ${finalText.length} chars`);
        }
      } else if (ANTHROPIC_API_KEY) {
        // Fallback to Claude with retry logic
        let response;
        let lastError;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
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
              logger.debug(`✅ [Claude Fallback] Success on attempt ${attempt}`);
              break;
            } else {
              lastError = await response.text().catch(() => 'Claude API error');
              
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          } catch (fetchError) {
            lastError = fetchError.message;
            
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!response || !response.ok) {
          finalText = '⚠️ Atlas had an error contacting Claude. Please try again.';
        } else {
          const data = await response.json();
          finalText = data?.content?.[0]?.text || finalText;
        }
      }
    } catch (oneShotErr) {
      logger.error('[Server] One-shot prompt error:', oneShotErr.message || oneShotErr);
    }

    const aiResponse = {
      id: uuidv4(),
      conversation_id: finalConversationId,
      user_id: userId,
      role: 'assistant',
      content: finalText, // ✅ FIX: Send plain string, not object (Supabase stringifies objects)
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
          logger.error('[Server] Error saving assistant response:', responseError.message || responseError);
        } else {
          logger.debug('✅ [Backend] Saved assistant message');
          storedResponse = stored;
        }
      } catch (error) {
        logger.error('[Server] Error storing assistant response:', error.message || error);
      }
    }

    res.json({
      success: true,
      message: storedMessage,
      response: storedResponse,
      conversationId: messageData.conversation_id
    });

  } catch (error) {
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

    logger.debug('[Image Analysis] 🚀 Starting analysis with URL-based approach (no download needed)');

    // ✅ PERFORMANCE FIX: Use URL directly instead of downloading and converting to base64
    // This saves memory, bandwidth, and processing time (33% payload reduction)
    
    // Call Claude Vision API with URL (with retry logic)
    let response;
    let lastError;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5-20250929', // ✅ NEW MODEL
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
                      url: imageUrl  // ✅ Direct URL - no download/encoding needed!
                    }
                  }
                ]
              }
            ]
          })
        });

        if (response.ok) {
          logger.debug(`✅ [Image Analysis] Claude Vision API call successful on attempt ${attempt} (URL-based)`);
          break; // Success, exit retry loop
        } else {
          lastError = await response.text().catch(() => 'Claude Vision API error');
          
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (fetchError) {
        lastError = fetchError.message;
        
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!response || !response.ok) {
      return res.status(500).json({ 
        error: 'Image analysis failed after 3 attempts',
        details: lastError,
        suggestion: 'This appears to be a temporary network issue. Please try again in a few minutes.'
      });
    }

    const result = await response.json();
    const analysis = result.content[0].text;

    logger.debug('✅ [Image Analysis] Analysis complete');

    // ✅ NEW: Save user image message to conversation history
    const conversationId = req.body.conversationId || null;

    // ✅ SAFETY: Check for empty string conversationId
    if (conversationId && conversationId.trim() && userId && supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        // Save user's image message
        const { error: userMsgError } = await supabase
          .from('messages')
          .insert({
            user_id: userId,
            conversation_id: conversationId,
            role: 'user',
            content: prompt,
            // ✅ FIX: Use ONLY attachments array, not both image_url and attachments
            attachments: [{ type: 'image', url: imageUrl }],
            created_at: new Date().toISOString()
          });

        if (userMsgError) {
          logger.error('[Image Analysis] Failed to save user message:', userMsgError.message);
        } else {
          logger.debug('✅ [Image Analysis] Saved user image message');
        }

        // Save AI analysis response
        const { error: aiMsgError } = await supabase
          .from('messages')
          .insert({
            user_id: userId,
            conversation_id: conversationId,
            role: 'assistant',
            content: analysis,
            created_at: new Date().toISOString()
          });

        if (aiMsgError) {
          logger.error('[Image Analysis] Failed to save AI response:', aiMsgError.message);
        } else {
          logger.debug('✅ [Image Analysis] Saved AI response');
        }
      } catch (saveError) {
        logger.error('[Image Analysis] Error saving messages:', saveError.message);
        // Continue - don't fail the request if save fails
      }
    }

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
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// 🎙️ Audio transcription endpoint using OpenAI Whisper
app.post('/api/transcribe', verifyJWT, async (req, res) => {
  try {
    const { audioUrl, language = 'en' } = req.body;
    const userId = req.user.id;
    
    if (!audioUrl) {
      return res.status(400).json({ error: 'Audio URL is required' });
    }

    // 🎯 TIER ENFORCEMENT: Check if user has audio access (Core/Studio only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, usage_stats')
      .eq('id', userId)
      .single();
    
    const tier = profile?.subscription_tier || 'free';
    
    if (tier === 'free') {
      return res.status(403).json({ 
        error: 'Audio transcription requires Core or Studio tier',
        upgradeRequired: true,
        feature: 'audio_transcription',
        tier: 'free'
      });
    }

    if (!openai) {
      return res.status(503).json({ error: 'Audio transcription service unavailable' });
    }


    // Download audio file from Supabase Storage
    let audioBuffer;
    try {
      const audioResponse = await fetch(audioUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
        }
      });
      
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`);
      }
      
      audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      logger.debug(`✅ [Transcribe] Audio downloaded: ${audioBuffer.length} bytes`);
    } catch (downloadError) {
      return res.status(400).json({ 
        error: 'Failed to download audio file',
        details: downloadError.message
      });
    }

    // Create a temporary file for Whisper API (it requires a file, not buffer)
    const { writeFile, unlink } = await import('fs/promises');
    const tmpFile = path.join('/tmp', `audio_${Date.now()}.webm`);
    
    try {
      await writeFile(tmpFile, audioBuffer);
      
      // Transcribe with OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: await import('fs').then(fs => fs.createReadStream(tmpFile)),
        model: 'whisper-1',
        language: language,
        response_format: 'verbose_json'
      });
      
      logger.debug(`✅ [Transcribe] Transcription complete: "${transcription.text.slice(0, 50)}..."`);
      
      // Clean up temp file
      await unlink(tmpFile).catch(() => {});
      
      // Store transcription in database for usage tracking
      if (supabaseUrl !== 'https://your-project.supabase.co') {
        try {
          const duration = transcription.duration || 0;
          
          // Track audio usage (in minutes)
          const currentUsage = profile?.usage_stats?.audio_minutes_used || 0;
          const newUsage = currentUsage + (duration / 60);
          
          await supabase.from('profiles').update({
            usage_stats: {
              ...profile?.usage_stats,
              audio_minutes_used: Math.ceil(newUsage)
            }
          }).eq('id', userId);
          
        } catch (dbError) {
          logger.error('[Server] Error updating audio usage stats:', dbError.message || dbError);
        }
      }
      
      res.json({
        transcript: transcription.text,
        confidence: 1.0, // Whisper doesn't provide confidence scores
        language: transcription.language || language,
        duration: transcription.duration || 0
      });
      
    } catch (whisperError) {
      await unlink(tmpFile).catch(() => {});
      
      return res.status(500).json({ 
        error: 'Transcription failed',
        details: whisperError.message
      });
    }
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// 🚀 DEEPGRAM STT - 22x faster than Whisper (300ms vs 6.8s)
app.post('/api/stt-deepgram', verifyJWT, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { audio } = req.body; // base64 audio (without data:audio/webm;base64, prefix)
    const userId = req.user.id;
    
    if (!audio) {
      return res.status(400).json({ error: 'Audio data required' });
    }
    
    // Check Deepgram API key
    const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
    if (!DEEPGRAM_API_KEY) {
      logger.error('[Deepgram] API key not configured');
      return res.status(500).json({ error: 'STT service not configured' });
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    logger.debug(`[Deepgram] Processing ${(audioBuffer.length / 1024).toFixed(1)}KB audio`);
    
    // Call Deepgram API
    // Deepgram auto-detects format, but we'll hint at webm
    const deepgramResponse = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en&punctuate=true&utterances=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/webm', // Deepgram will auto-detect if different
        },
        body: audioBuffer,
      }
    );
    
    if (!deepgramResponse.ok) {
      const error = await deepgramResponse.text();
      logger.error('[Deepgram] API error:', error);
      return res.status(deepgramResponse.status).json({ 
        error: 'Transcription failed',
        details: error 
      });
    }
    
    const result = await deepgramResponse.json();
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    const duration = result.metadata?.duration || 0;
    const latency = Date.now() - startTime;
    
    logger.info(`[Deepgram] ✅ STT success: "${transcript.substring(0, 50)}...", ${latency}ms, confidence: ${(confidence * 100).toFixed(1)}%`);
    
    // Log usage for cost tracking
    if (supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        await supabase.from('usage_logs').insert({
          user_id: userId,
          event: 'stt_deepgram',
          data: {
            transcript_length: transcript.length,
            audio_duration: duration,
            latency_ms: latency,
            confidence: confidence,
            cost: duration * 0.0125 / 60 // $0.0125 per minute
          },
          created_at: new Date().toISOString()
        });
      } catch (logError) {
        logger.error('[Deepgram] Failed to log usage:', logError.message);
      }
    }
    
    res.json({ 
      text: transcript,
      confidence: confidence,
      duration_seconds: duration,
      latency_ms: latency
    });
    
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.error(`[Deepgram] Error: ${error.message}, ${latency}ms`);
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});

// 🔊 Text-to-speech endpoint using OpenAI TTS
app.post('/api/synthesize', verifyJWT, async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.user.id;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // 🎯 TIER ENFORCEMENT: Check if user has audio access (Core/Studio only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
    
    const tier = profile?.subscription_tier || 'free';
    
    if (tier === 'free') {
      return res.status(403).json({ 
        error: 'Text-to-speech requires Core or Studio tier',
        upgradeRequired: true,
        feature: 'text_to_speech',
        tier: 'free'
      });
    }

    if (!openai) {
      return res.status(503).json({ error: 'Text-to-speech service unavailable' });
    }

    // 🎯 Tier-based model selection (temporarily using core tier settings)
    // Core: tts-1 (faster, cheaper)
    // Studio: tts-1-hd (higher quality)
    const model = 'tts-1'; // Always use standard quality for testing
    const voice = 'alloy'; // Always use alloy voice for testing


    try {
      // Generate speech with OpenAI TTS
      const mp3 = await openai.audio.speech.create({
        model: model,
        voice: voice,
        input: text.trim(),
        speed: 1.0
      });

      // Convert stream to buffer
      const audioBuffer = Buffer.from(await mp3.arrayBuffer());
      
      logger.debug(`✅ [Synthesize] Audio generated: ${audioBuffer.length} bytes`);
      
      // Return audio as base64 (for easy frontend handling)
      const audioBase64 = audioBuffer.toString('base64');
      
      res.json({
        success: true,
        audio: audioBase64,
        format: 'mp3',
        size: audioBuffer.length,
        model: model,
        voice: voice
      });
      
    } catch (openaiError) {
      return res.status(500).json({ 
        error: 'Speech synthesis failed',
        details: openaiError.message
      });
    }
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Get conversation messages
app.get('/api/conversations/:conversationId/messages', 
  verifyJWT, 
  cacheTierMiddleware,
  apiCacheMiddleware({ ttlCategory: 'messages', varyByTier: true }),
  async (req, res) => {
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
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    res.json({ messages });

  } catch (error) {
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


    // Get MailerLite API key from environment
    const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
    
    if (!MAILERLITE_API_KEY) {
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
    
    logger.debug(`✅ MailerLite event ${event} triggered successfully for ${email}`);
    
    res.json({ 
      success: true, 
      message: `Event ${event} triggered successfully`,
      data: result 
    });

  } catch (error) {
    
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


    const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
    
    if (!MAILERLITE_API_KEY) {
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
    logger.debug(`✅ Subscriber ${email} synced successfully`);

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
        logger.debug(`✅ Subscriber ${email} added to group ${targetGroup}`);
      } catch (groupError) {
        logger.error('[Server] Error adding subscriber to group:', groupError.message || groupError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Subscriber synced successfully',
      data: result 
    });

  } catch (error) {
    
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

    if (!userId) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    // User is already verified by JWT middleware
    const authUser = req.user;
    
    if (!authUser?.id) {
      return res.status(401).json({ error: 'Missing or invalid authenticated user.' });
    }

    // Then fetch or create user_profile safely
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();


    if (error && error.code === 'PGRST116') {
      // Create fallback profile if missing
      const profileData = {
        id: userId,
        email: `user-${userId}@atlas.dev`,
        preferences: {},
        subscription_tier: 'free'
      };
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([profileData])
        .select()
        .single();


      if (createError) {
        return res.status(500).json({ error: "Failed to create user profile", details: createError });
      }

      logger.debug(`✅ Created fallback profile for user: ${userId}`);
      return res
        .set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        .set('Pragma', 'no-cache')
        .set('Expires', '0')
        .status(200)
        .json(newProfile);
    }

    if (error) {
      return res.status(500).json({ error: "Database error", details: error });
    }

    return res
      .set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .status(200)
      .json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user profile endpoint
app.post('/v1/user_profiles', verifyJWT, async (req, res) => {
  try {
    const { user_id } = req.body;

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
      return res.status(401).json({ error: 'Missing or invalid authenticated user.' });
    }

    const profileData = {
      id: user_id,
      email: `user-${user_id}@atlas.dev`,
      preferences: {},
      subscription_tier: 'free'
    };

    const { data: newProfile, error: createError } = await supabase
      .from("profiles")
      .insert([profileData])
      .select()
      .single();


    if (createError) {
      return res.status(500).json({ error: "Failed to create user profile", details: createError });
    }

    logger.debug(`✅ Created user profile for user: ${user_id}`);
    return res
      .set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .status(201)
      .json(newProfile);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🔒 SECURITY FIX: REMOVED public tier update endpoint
// ❌ This endpoint allowed anyone to upgrade their tier without payment
// ✅ Tier updates now ONLY happen via FastSpring webhook with signature verification
// 
// Previously at: app.put('/v1/user_profiles/:id', ...)
// Removed for security: Users must not be able to modify their own subscription_tier

// FastSpring checkout creation endpoint
app.post('/api/fastspring/create-checkout', async (req, res) => {
  try {
    const { userId, tier, email, productId, successUrl, cancelUrl } = req.body;

    if (!userId || !tier || !email || !productId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const FASTSPRING_API_USERNAME = process.env.FASTSPRING_API_USERNAME;
    const FASTSPRING_API_PASSWORD = process.env.FASTSPRING_API_PASSWORD;
    const FASTSPRING_STORE_ID = process.env.FASTSPRING_STORE_ID;
    const FASTSPRING_ENVIRONMENT = process.env.VITE_FASTSPRING_ENVIRONMENT || 'test';
    
    if (!FASTSPRING_API_USERNAME || !FASTSPRING_API_PASSWORD || !FASTSPRING_STORE_ID) {
      return res.status(500).json({ error: 'FastSpring API credentials not configured' });
    }

    // Use test or production API based on environment
    // Note: FastSpring uses the same API endpoint, test vs live is determined by store settings
    const apiBaseUrl = 'https://api.fastspring.com';

    // Create FastSpring checkout session with Basic Auth
    const authString = Buffer.from(`${FASTSPRING_API_USERNAME}:${FASTSPRING_API_PASSWORD}`).toString('base64');
    
    logger.info(`[FastSpring] Creating checkout for ${productId}`);
    
    const fastspringResponse = await fetch(`${apiBaseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: [
          {
            path: productId,
            quantity: 1
          }
        ],
        contact: {
          email: email,
          firstName: 'Atlas',
          lastName: 'User'
        },
        tags: {
          user_id: userId,
          tier: tier
        },
        redirectUrls: {
          success: successUrl,
          cancel: cancelUrl
        }
      })
    });

    if (!fastspringResponse.ok) {
      const error = await fastspringResponse.text();
      logger.error(`[FastSpring] API Error (${fastspringResponse.status}):`, error);
      return res.status(500).json({ 
        error: 'Failed to create checkout session', 
        status: fastspringResponse.status,
        details: error 
      });
    }

    const checkoutData = await fastspringResponse.json();
    
    // Log the full response to see what FastSpring returns
    logger.info(`[FastSpring] API Response:`, JSON.stringify(checkoutData));
    
    // FastSpring Sessions API should return the checkout URL directly
    // If not, we need to construct it ourselves
    let checkoutUrl = checkoutData.url || checkoutData.checkoutUrl;
    
    if (!checkoutUrl && checkoutData.id) {
      // Fallback: construct URL manually
      const storeDomain = FASTSPRING_STORE_ID.replace(/_/g, '-');
      const storefront = FASTSPRING_ENVIRONMENT === 'live' 
        ? `https://${storeDomain}.onfastspring.com`
        : `https://${storeDomain}.test.onfastspring.com`;
      checkoutUrl = `${storefront}/popup-${checkoutData.id}`;
    }
    
    logger.info(`[FastSpring] Checkout created: ${checkoutUrl}`);
    
    return res.status(200).json({
      checkoutUrl: checkoutUrl,
      sessionId: checkoutData.id
    });

  } catch (error) {
    logger.error('[FastSpring] Checkout creation error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// 📊 Feature attempts tracking endpoint
app.post('/api/feature-attempts', async (req, res) => {
  try {
    const { userId, feature, tier } = req.body;

    // Validate required fields
    if (!userId || !feature || !tier) {
      return res.status(400).json({ 
        error: "Missing required fields: userId, feature, tier" 
      });
    }

    // Skip logging in development if table doesn't exist
    if (supabaseUrl === 'https://your-project.supabase.co') {
      return res.json({ status: "ok", dev: true });
    }

    const { error } = await supabase
      .from("feature_attempts")
      .insert({
        user_id: userId,
        feature,
        tier,
        created_at: new Date().toISOString()
      });

    if (error) {
      // If table doesn't exist, just log and continue (non-critical)
      return res.json({ status: "ok", warning: "Table not found" });
    }

    res.json({ status: "ok" });
  } catch (err) {
    // Return success anyway - this is non-critical telemetry
    res.json({ status: "ok", error: err.message });
  }
});

// Serve built Vite frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Serve static files (if any)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback route - serve the frontend app (catch all routes)
app.get('*', (req, res) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/message') && !req.path.startsWith('/healthz')) {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    res.status(404).json({ error: 'Route not found' });
  }
});

// Sentry error handler must be after all other middleware and routes
app.use(sentryMiddleware.errorHandler);

// Global error handler (after Sentry)
app.use((err, req, res, next) => {
  // Log the error
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id
  });

  // Send error response
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    // Only send stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    // Flush Sentry before exit
    await flushSentry();
    
    // Close Redis connection
    await redisService.shutdown();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server - bind to all interfaces for mobile access
// ✅ Support HTTPS if certs exist (for camera/audio testing)
const certPath = path.join(__dirname, '..', 'localhost+1.pem');
const keyPath = path.join(__dirname, '..', 'localhost+1-key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  
  https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
    logger.info(`✅ Atlas backend (HTTPS) running on port ${PORT}`);
    logger.info(`   Healthcheck: https://0.0.0.0:${PORT}/healthz`);
    console.log(`🚀 Server started on port ${PORT}`);
  });
} else {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`✅ Atlas backend (HTTP) running on port ${PORT}`);
    logger.info(`   Healthcheck: http://0.0.0.0:${PORT}/healthz`);
    console.log(`🚀 Server started on port ${PORT}`);
  });
}
