// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env.local';

console.log(`🌍 Environment: ${nodeEnv}`);
console.log(`📁 Loading environment from: ${envFile}`);

// Load environment variables from the appropriate .env file IMMEDIATELY
dotenv.config({ path: path.join(__dirname, "..", envFile) });

// Verify critical environment variables are loaded
const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const optionalVars = ['VITE_PADDLE_CLIENT_TOKEN', 'VITE_PADDLE_CORE_PRICE_ID', 'VITE_PADDLE_STUDIO_PRICE_ID'];

const missingRequired = requiredVars.filter(varName => !process.env[varName]);
const missingOptional = optionalVars.filter(varName => !process.env[varName]);

if (missingRequired.length > 0) {
  console.error(`❌ MISSING REQUIRED ENVIRONMENT VARIABLES: ${missingRequired.join(', ')}`);
  console.error(`📁 Check your ${envFile} file`);
  
  if (isCI) {
    console.error(`🚨 CI Environment detected - this is expected if secrets are not configured`);
    console.error(`💡 For CI builds, set these as GitHub Secrets or use placeholder values`);
  } else {
    console.error(`🚨 Backend cannot start without these variables`);
    process.exit(1);
  }
}

if (missingOptional.length > 0) {
  console.warn(`⚠️  Missing optional environment variables: ${missingOptional.join(', ')}`);
  console.warn(`📝 Paddle features will be disabled until these are configured`);
}

console.log('✅ Required environment variables loaded successfully');
console.log(`✅ Supabase URL: ${process.env.SUPABASE_URL}`);
console.log(`✅ Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '***configured***' : 'MISSING'}`);
console.log(`✅ Anon Key: ${process.env.SUPABASE_ANON_KEY ? '***configured***' : 'MISSING'}`);

// Additional safety check for critical variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("❌ Critical Supabase environment variables missing");
  if (!isCI) {
    process.exit(1);
  }
}

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import { logError, logInfo, logWarn } from "./utils/logger.mjs";

// 🛡️ Import middleware stack
import authMiddleware from "./middleware/authMiddleware.mjs";

// 🧠 Import intelligent tier gate system
import { estimateRequestCost, selectOptimalModel } from './config/intelligentTierSystem.mjs';

// 🔐 Import Supabase client (now with lazy initialization)
import { supabase } from './config/supabaseClient.mjs';
import { budgetCeilingService } from './services/budgetCeilingService.mjs';
import { promptCacheService } from './services/promptCacheService.mjs';

// ⏰ Import cron service for automated tasks
import { startWeeklyReportCron } from './services/cronService.mjs';

// 🤖 Import Anthropic for real AI responses
import Anthropic from '@anthropic-ai/sdk';

const app = express();

// 🤖 Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 🛡️ Production Security Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow embedding for better compatibility
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// 📊 Request Logging
if (nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 🔐 JWT verification middleware with development fallback
const verifyJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    // Development mode: allow mock token
    if (token === 'mock-token-for-development') {
      const mockUserId = '65fcb50a-d67d-453e-a405-50c6aef959be'; // Use real user ID from logs
      req.user = { id: mockUserId };
      console.log('🔓 Using mock token for development, user:', mockUserId);
      return next();
    }
    
    // Verify the JWT token with Supabase (both dev and prod)
    console.log('🔐 Verifying JWT token with Supabase...');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('❌ JWT verification error:', error);
      return res.status(401).json({ error: 'Invalid or expired token', details: error.message });
    }
    
    if (!user) {
      console.error('❌ No user found in JWT token');
      return res.status(401).json({ error: 'No user found in token' });
    }

    console.log('✅ JWT verified successfully for user:', user.id);
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ JWT verification error:', error);
    res.status(401).json({ error: 'Token verification failed', details: error.message });
  }
};

// 🚦 Rate Limiting - DISABLED for development
const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
console.log(`🚦 Rate Limiting - NODE_ENV: ${process.env.NODE_ENV}, isDev: ${isDev}`);

// Create a no-op rate limiter for development
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 999999 : 100, // Essentially unlimited for dev
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests from this IP' },
  standardHeaders: false, // Disable rate limit headers in development
  legacyHeaders: false,
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 200 : 20, // Much higher limit for dev
  message: { error: 'MESSAGE_RATE_LIMIT_EXCEEDED', message: 'Too many message requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global rate limiting (always enabled, but with high limits in development)
app.use(globalLimiter);
console.log(`🚦 Rate limiting configured - isDev: ${isDev}, max requests: ${isDev ? 999999 : 100}`);

// Middleware
app.use(express.json({ limit: '2mb' }));

// CORS middleware - allow frontend connections
const allowedOrigins = [
  "http://localhost:5173",   // Vite dev server
  "http://localhost:5174",   // Backup Vite port
  "http://localhost:5175",   // Additional Vite port
  "http://localhost:5176",   // Additional Vite port
  "http://localhost:4173",   // Vite preview server (production build)
  "http://127.0.0.1:4173",   // Vite preview server (127.0.0.1 variant)
  "http://localhost:8081",   // Expo web
  "http://localhost:3000",   // Backend self-calls
  "http://192.168.0.10:5173",
  "http://192.168.0.10:5174",
  "http://192.168.0.10:5175",
  "http://192.168.0.10:5176",
  "http://192.168.0.10:4173", // Network preview server
  /^https:\/\/atlas-.*\.vercel\.app$/,
  /^https:\/\/atlas.*\.up\.railway\.app$/,
  /^https:\/\/.*\.railway\.app$/
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      console.log(`✅ CORS: Allowing origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: Blocking origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'authorization']
}));

// Handle preflight requests
app.options("*", cors());

// Add debug route for subscription inspection (bypasses auth for debugging)
app.get("/api/debug/subscriptions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[DEBUG] Checking paddle_subscriptions for user: ${userId}`);
    
    const { data, error } = await supabase
      .from("paddle_subscriptions")
      .select("*")
      .eq("id", userId);
      
    if (error) {
      console.error(`[DEBUG] Supabase error:`, error);
      return res.status(500).json({ source: "supabase", error: error.message });
    }
    
    console.log(`[DEBUG] Found ${data?.length || 0} paddle subscription records`);
    res.json({ source: "supabase", data, count: data?.length || 0 });
  } catch (err) {
    console.error("Debug route error:", err.message);
    res.status(500).json({ error: "Debug route failed", details: err.message });
  }
});

// Global auth middleware (except for health endpoints, paddle test, and JWT-protected routes)
app.use((req, res, next) => {
  // Skip auth middleware for public endpoints
  if (req.path === '/healthz' || req.path === '/api/healthz' || req.path === '/ping' || req.path === '/admin/paddle-test') {
    return next();
  }
  
  // Skip auth middleware for routes that use their own auth (verifyJWT or requireAdminDev)
  if (req.path.startsWith('/v1/user_profiles') || req.path === '/message' || req.path.startsWith('/admin') || req.path.startsWith('/api/feature-attempts') || req.path.startsWith('/api/debug')) {
    return next();
  }
  
  return authMiddleware(req, res, next);
});

// Universal health payload
const healthPayload = () => ({
  status: "ok",
  uptime: process.uptime(),
  timestamp: Date.now(),
  version: "1.0.0",
  tierGateSystem: "active"
});

// --- Health endpoints ---
app.get("/healthz", async (req, res) => {
  try {
    // Check if Supabase is initialized
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ 
        status: "error", 
        message: "Supabase not initialized",
        version: "1.0.0"
      });
    }
    
    await logInfo("Health check pinged", { env: process.env.NODE_ENV });
    res.status(200).json(healthPayload());
  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      message: "Health check failed",
      version: "1.0.0"
    });
  }
});
app.get("/api/healthz", (req, res) => res.status(200).json(healthPayload()));
app.get("/ping", (req, res) => res.status(200).json({ status: "ok", timestamp: new Date().toISOString() }));

// --- User Profile Endpoints ---
// User profile endpoint with fallback creation
app.get('/v1/user_profiles/:id', verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('🔍 User profile endpoint called for user:', userId);

    // Verify user exists in auth.users first
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) {
      console.warn('🚫 User not found in auth.users:', userId);
      return res.status(404).json({ 
        error: 'User not found',
        message: `User ${userId} does not exist in authentication system`
      });
    }

    // Then fetch or create user_profile safely
    console.log('🔍 Checking if profile exists for user:', userId);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error fetching profile:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    if (profile) {
      console.log('✅ Profile found:', profile);
      return res.json(profile);
    }

    // Create profile if it doesn't exist
    console.log('📝 Creating new profile for user:', userId);
    const profileData = {
      id: userId,
      email: authUser.user.email,
      subscription_tier: 'free',
      subscription_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('🔍 Creating profile with data:', profileData);
    
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert([profileData])
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating profile:', createError);
      return res.status(500).json({ error: 'Failed to create profile' });
    }

    console.log('✅ Profile created successfully:', newProfile);
    res.json(newProfile);

  } catch (error) {
    console.error('❌ Profile endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user profile endpoint
app.post('/v1/user_profiles', verifyJWT, async (req, res) => {
  try {
    const { user_id } = req.body;
    console.log('🔍 Create user profile endpoint called for user:', user_id);

    // Verify user exists in auth.users first
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);
    if (authError || !authUser?.user) {
      console.warn('🚫 User not found in auth.users:', user_id);
      return res.status(404).json({ 
        error: 'User not found',
        message: `User ${user_id} does not exist in authentication system`
      });
    }

    // Create profile
    const profileData = {
      id: user_id,
      email: authUser.user.email,
      subscription_tier: 'free',
      subscription_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('🔍 Creating profile with data:', profileData);

    const { data: newProfile, error: createError } = await supabase
      .from("profiles")
      .insert([profileData])
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating profile:', createError);
      return res.status(500).json({ error: 'Failed to create profile' });
    }

    console.log('✅ Profile created successfully:', newProfile);
    res.json(newProfile);

  } catch (error) {
    console.error('❌ Create profile endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Update subscription tier (for dev tier switcher) ---
app.patch('/v1/user_profiles/:id/tier', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { tier } = req.body;
    const requestingUserId = req.user.id;

    console.log('🔍 Update tier endpoint called for user:', id, 'to tier:', tier);

    // Verify the requesting user can update this profile (must be the same user)
    if (requestingUserId !== id) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only update your own subscription tier'
      });
    }

    // Validate tier
    const validTiers = ['free', 'core', 'studio'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ 
        error: 'Invalid tier',
        message: `Tier must be one of: ${validTiers.join(', ')}`
      });
    }

    // Update the profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({ 
        subscription_tier: tier,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating tier:', updateError);
      return res.status(500).json({ error: 'Failed to update subscription tier' });
    }

    console.log('✅ Tier updated successfully:', updatedProfile);
    res.json(updatedProfile);

  } catch (error) {
    console.error('❌ Update tier endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Enhanced message endpoint with conversation memory ---
app.post("/message", 
  verifyJWT, // JWT verification
  // Smart daily limit middleware - only for free tier
  async (req, res, next) => {
    try {
      // Development bypass
      if (process.env.DEV_BYPASS_LIMITS === 'true' || process.env.DISABLE_RATE_LIMIT === 'true') {
        console.log('[DEV] Bypassing all limits for development');
        return next();
      }
      
      const { tier = 'free' } = req.body;
      const userId = req.user?.id;
      
      // Only apply limits to free tier
      if (tier !== 'free') {
        console.log(`[USAGE] userId=${userId}, tier=${tier}, unlimited=true`);
        return next();
      }
      
      // Check daily usage for free tier
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_usage')
        .select('conversations_count')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();
        
      if (error) {
        console.error('Error checking daily usage:', error);
        return next(); // Allow on error
      }
      
      const currentCount = data?.conversations_count || 0;
      console.log(`[USAGE] userId=${userId}, tier=${tier}, messagesToday=${currentCount}`);
      
      if (currentCount >= 15) {
        return res.status(429).json({
          success: false,
          message: 'Daily free message limit reached (15/day). Upgrade to Core for unlimited messages.',
          upgrade: true,
          remainingMessages: 0
        });
      }
      
      next();
    } catch (error) {
      console.error('Daily limit middleware error:', error);
      next(); // Allow on error
    }
  },
  async (req, res) => {
    try {
      const { userId, message, type = 'chat', tier: clientTier = 'free', conversationId } = req.body;
      const actualUserId = req.user?.id || userId;
      
      // 1. Fetch subscription tier from Supabase (authoritative source)
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", actualUserId)
        .single();

      if (error) {
        console.error("[Tier] Supabase error", error);
        return res.status(500).json({ error: "Failed to fetch profile" });
      }

      const dbTier = profile?.subscription_tier || "free";

      // 2. Compare client vs backend tier
      if (clientTier && clientTier !== dbTier) {
        console.warn(`[Tier] Mismatch: client=${clientTier}, db=${dbTier}`);
      }

      // 3. Always trust the DB
      const effectiveTier = dbTier;
      
      // DEBUG: Log incoming request
      console.log("[DEBUG] Incoming message request:", {
        hasMessage: !!message,
        hasTier: !!clientTier,
        hasUserId: !!actualUserId,
        incomingConversationId: conversationId,
        messagePreview: message?.slice(0, 50) + '...',
        clientTier,
        dbTier,
        effectiveTier
      });
      
      if (!message) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required field: message' 
        });
      }
      
      // 🧠 CONVERSATION MEMORY: Find or create conversation
      let currentConversationId = conversationId;
      
      if (!currentConversationId) {
        // Create new conversation with first message as title
        const conversationTitle = message.length > 50 
          ? message.substring(0, 47) + '...' 
          : message;
          
        const { data: newConversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            user_id: actualUserId,
            title: conversationTitle
          })
          .select()
          .single();
          
        if (convError) {
          console.error('Error creating conversation:', convError);
          // Continue without conversation tracking
        } else {
          currentConversationId = newConversation.id;
          console.log(`[MEMORY] Created new conversation: ${currentConversationId}`);
        }
      } else {
        console.log(`[MEMORY] Continuing conversation: ${currentConversationId}`);
      }
      
      // 💾 MEMORY: Store user message
      if (currentConversationId) {
        const { error: userMsgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: currentConversationId,
            role: 'user',
            content: message
          });
          
        if (userMsgError) {
          console.error('Error storing user message:', userMsgError);
        }
      }
      
      // 🧠 MEMORY: Load conversation context for Claude
      let conversationMessages = [];
      if (currentConversationId) {
        const { data: previousMessages, error: msgError } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', currentConversationId)
          .order('created_at', { ascending: true })
          .limit(20); // Last 20 messages for context
          
        if (!msgError && previousMessages) {
          conversationMessages = previousMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          }));
          console.log(`[MEMORY] Loaded ${conversationMessages.length} previous messages for context`);
        }
      }

      await logInfo("Message API called with intelligent tier system", { 
        userId, 
        tier: effectiveTier, 
        hasMessage: !!message,
        messageLength: message.length
      });

      // 🛡️ STEP 1: Budget ceiling check
      const budgetCheck = await budgetCeilingService.checkBudgetCeiling(effectiveTier);
      if (!budgetCheck.allowed) {
        return res.status(429).json({
          success: false,
          message: budgetCheck.message,
          upgrade: effectiveTier === 'free'
        });
      }

      // 🧠 STEP 2: Intelligent model selection
      const selectedModelName = selectOptimalModel(effectiveTier, message, type);
      
      // 💾 STEP 3: Get cached system prompt
      const systemPrompt = await promptCacheService.get(
        'systemPersonality', 
        { tier: effectiveTier, userId }, 
        `You are Atlas, an emotionally intelligent AI assistant focused on emotional wellbeing and mental health support. You help users develop emotional intelligence, manage stress, and build healthier habits.`
      );

      await logInfo("Intelligent tier processing", { 
        tier: effectiveTier,
        selectedModel: selectedModelName,
        systemPromptCached: systemPrompt.includes('User Context'),
        budgetPriority: budgetCheck.priorityOverride || false
      });

      // 🤖 STEP 4: Real AI processing with Anthropic
      let aiResponse;
      let actualInputTokens = 0;
      let actualOutputTokens = 0;
      
      try {
        if (process.env.ANTHROPIC_API_KEY) {
          await logInfo("Calling Anthropic API", {
            model: selectedModelName,
            hasApiKey: !!process.env.ANTHROPIC_API_KEY,
            messageLength: message.length,
            tier: effectiveTier
          });
          
          // 🧠 Build messages array with conversation context
          const messages = [...conversationMessages];
          // Always ensure the current message is included (in case it's not in DB yet)
          if (messages.length === 0 || messages[messages.length - 1].content !== message) {
            messages.push({
              role: 'user',
              content: message
            });
          }

          const response = await anthropic.messages.create({
            model: selectedModelName,
            max_tokens: 1000,
            system: systemPrompt,
            messages: messages
          });
          
          aiResponse = response.content[0].text;
          actualInputTokens = response.usage.input_tokens;
          actualOutputTokens = response.usage.output_tokens;
          
          await logInfo("Real AI response generated successfully", {
            model: selectedModelName,
            inputTokens: actualInputTokens,
            outputTokens: actualOutputTokens,
            responseLength: aiResponse.length,
            tier: effectiveTier
          });
        } else {
          // Fallback to enhanced mock response if no API key
          if (type === 'file_analysis') {
            // Special handling for file analysis
            const fileType = req.body.fileType || 'file';
            const fileUrl = req.body.fileUrl || '';
            
            if (fileType === 'audio') {
              aiResponse = `I've received your audio recording! As your ${effectiveTier} tier Atlas companion, I can analyze audio content for emotional insights, speech patterns, and key topics discussed. However, I'm currently experiencing some technical difficulties with audio processing. Please try again in a moment, or feel free to describe what you'd like me to help you with regarding this recording.`;
            } else if (fileType === 'camera' || fileType === 'image') {
              aiResponse = `I've received your image! As your ${effectiveTier} tier Atlas companion, I can analyze images for visual content, emotional context, and relevant details. However, I'm currently experiencing some technical difficulties with image processing. Please try again in a moment, or feel free to describe what you'd like me to help you with regarding this image.`;
            } else {
              aiResponse = `I've received your file! As your ${effectiveTier} tier Atlas companion, I can analyze various file types. However, I'm currently experiencing some technical difficulties with file processing. Please try again in a moment, or feel free to describe what you'd like me to help you with regarding this file.`;
            }
          } else {
            // Regular text response
            aiResponse = `Hello! I'm Atlas, your AI-powered emotional intelligence companion. ` + 
              (effectiveTier === 'studio' ? 'As a Studio user, you get my most advanced emotional analysis and personalized insights. ' : '') +
              (effectiveTier === 'core' ? 'As a Core user, you have access to comprehensive emotional support and habit coaching. ' : '') +
              (effectiveTier === 'free' ? 'I\'m here to provide basic emotional support and guidance. ' : '') +
              `I understand you're reaching out about "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}" - how can I help you today?`;
          }
          
          // Estimate tokens for mock response
          actualInputTokens = Math.ceil((systemPrompt.length + message.length) / 4);
          actualOutputTokens = Math.ceil(aiResponse.length / 4);
        }
      } catch (error) {
        await logError("AI response generation failed", { error: error.message, model: selectedModelName, tier: effectiveTier });
        
        // Graceful fallback
        aiResponse = `I'm experiencing some technical difficulties right now. Please try again in a moment. ` +
          `As your ${effectiveTier} tier Atlas companion, I'm here to help with emotional intelligence and support.`;
        actualInputTokens = Math.ceil((systemPrompt.length + message.length) / 4);
        actualOutputTokens = Math.ceil(aiResponse.length / 4);
      }

      // 📊 STEP 5: Calculate actual token usage and cost
      const totalTokens = actualInputTokens + actualOutputTokens;
      const estimatedCost = estimateRequestCost(selectedModelName, actualInputTokens, actualOutputTokens);

      // 📊 STEP 6: Record budget spend and usage
      await budgetCeilingService.recordSpend(effectiveTier, estimatedCost, 1);

      // 📊 STEP 7: Update daily usage tracking
      const { supabase: client } = await import('./config/supabaseClient.mjs');
      if (client && userId) {
        // Update daily usage with actual tokens and cost
        await client.rpc('increment_conversation_count', {
          p_user_id: userId,
          p_tier: effectiveTier,
          p_tokens_used: totalTokens,
          p_cost_estimate: estimatedCost
        });
      }

      // 💾 MEMORY: Store assistant response
      if (currentConversationId && aiResponse) {
        const { error: assistantMsgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: currentConversationId,
            role: 'assistant',
            content: aiResponse
          });
          
        if (assistantMsgError) {
          console.error('Error storing assistant message:', assistantMsgError);
        } else {
          console.log(`[MEMORY] Stored assistant response in conversation: ${currentConversationId}`);
        }
      }
      
      // DEBUG: Log what we're returning
      console.log("[DEBUG] Returning response:", {
        conversationId: currentConversationId,
        preview: aiResponse?.slice(0, 80) + '...'
      });

      await logInfo("Message processed with intelligent tier system", { 
        tier: effectiveTier, 
        selectedModel: selectedModelName, 
        estimatedCost: estimatedCost.toFixed(6),
        totalTokens,
        inputTokens: actualInputTokens,
        outputTokens: actualOutputTokens,
        budgetPriority: budgetCheck.priorityOverride || false,
        conversationId: currentConversationId
      });

      res.json({
        success: true,
        response: aiResponse,
        conversationId: currentConversationId,
        metadata: {
          tier: effectiveTier,
          model: selectedModelName,
          tokensUsed: totalTokens,
          estimatedCost: estimatedCost.toFixed(6),
          budgetStatus: {
            priorityOverride: budgetCheck.priorityOverride || false
          },
          intelligentSelection: {
            modelSelected: selectedModelName,
            reasoningType: type,
            messageLength: message.length
          },
          performance: {
            systemPromptCached: systemPrompt.includes('User Context'),
            costOptimized: true
          }
        }
      });

    } catch (error) {
      await logError("Message API error with intelligent tier system", { 
        error: error.message, 
        stack: error.stack,
        userId: req.body?.userId,
        tier: req.body?.tier || 'free'
      });
      
      res.status(500).json({
        success: false,
        message: "I'm experiencing some technical difficulties. Please try again in a moment.",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// --- Conversation History API Endpoints (Future-Proof) ---

// Get user's conversations
app.get("/api/conversations", verifyJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log(`[HISTORY] Fetching conversations for user ${userId}`);
    
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50); // Limit to recent 50 conversations
      
    if (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
    
    console.log(`[HISTORY] Found ${conversations?.length || 0} conversations for user ${userId}`);
    res.json({ conversations: conversations || [] });
  } catch (error) {
    console.error('Conversations endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages for a specific conversation
app.get("/api/conversations/:id/messages", verifyJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;
    console.log(`[HISTORY] Fetching messages for conversation ${conversationId} (user: ${userId})`);
    
    // Verify user owns this conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();
      
    if (convError || !conversation) {
      console.log(`[HISTORY] Conversation ${conversationId} not found or not owned by user ${userId}`);
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
      
    if (msgError) {
      console.error('Error fetching messages:', msgError);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
    
    console.log(`[HISTORY] Found ${messages?.length || 0} messages for conversation ${conversationId}`);
    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('Messages endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Other routes ---
// Load admin routes dynamically after environment variables are set
try {
  const { default: adminRoutes } = await import("./routes/admin.js");
  app.use("/admin", adminRoutes);
  console.log("✅ Admin routes loaded successfully");
  await logInfo("Admin routes loaded successfully");
} catch (error) {
  console.warn("⚠️ Admin routes not found, continuing without them:", error.message);
  await logWarn("Admin routes not found", { error: error.message });
}

// Load Paddle test routes
try {
  const { default: paddleRoutes } = await import("./routes/paddle.mjs");
  app.use("/admin", paddleRoutes);
  console.log("✅ Paddle test routes loaded successfully");
  await logInfo("Paddle test routes loaded successfully");
} catch (error) {
  console.warn("⚠️ Paddle routes not found, continuing without them:", error.message);
  await logWarn("Paddle routes not found", { error: error.message });
}

// Load Paddle webhook routes
try {
  const { default: paddleWebhookRoutes } = await import("./routes/paddleWebhook.mjs");
  app.use("/paddle", paddleWebhookRoutes);
  console.log("✅ Paddle webhook routes loaded successfully");
  await logInfo("Paddle webhook routes loaded successfully");
} catch (error) {
  console.warn("⚠️ Paddle webhook routes not found, continuing without them:", error.message);
  await logWarn("Paddle webhook routes not found", { error: error.message });
}

// Load feature attempts routes
try {
  const { default: featureAttemptsRoutes } = await import("./routes/feature-attempts.mjs");
  app.use("/api/feature-attempts", featureAttemptsRoutes);
  console.log("✅ Feature attempts routes loaded successfully");
  await logInfo("Feature attempts routes loaded successfully");
} catch (error) {
  console.warn("⚠️ Feature attempts routes not found, continuing without them:", error.message);
  await logWarn("Feature attempts routes not found", { error: error.message });
}




// 🛡️ Global Error Handler
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err);
  
  // Don't leak error details in production
  const message = nodeEnv === 'development' ? err.message : 'Something went wrong';
  
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: message
  });
});

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Auth sanity check endpoint
app.get("/api/me", verifyJWT, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// --- Get user's daily usage ---
app.get("/api/usage/:userId", verifyJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id;

    // Verify the requesting user can access this usage (must be the same user)
    if (requestingUserId !== userId) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only access your own usage data'
      });
    }

    console.log('📊 Usage endpoint called for user:', userId);

    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const { data: usage, error } = await supabase
      .from('daily_usage')
      .select('conversations_count, total_tokens_used, api_cost_estimate')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching usage:', error);
      return res.status(500).json({ error: 'Failed to fetch usage data' });
    }

    // Return usage data (default to 0 if no record exists)
    const usageData = usage || {
      conversations_count: 0,
      total_tokens_used: 0,
      api_cost_estimate: 0
    };

    console.log('✅ Usage data retrieved:', usageData);
    res.json(usageData);

  } catch (error) {
    console.error('❌ Usage endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- File upload route: handles image, camera, audio, and file uploads ---
app.post("/api/upload", verifyJWT, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.user.id;
    const filename = `${userId}/${Date.now()}-${req.file.originalname}`;
    
    console.log("📤 Upload request received for user:", userId, "file:", req.file.originalname);

    // Upload to Supabase Storage
    const { error: upErr } = await supabase.storage
      .from("uploads")
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });
    
    if (upErr) {
      console.error("❌ Supabase storage error:", upErr);
      throw upErr;
    }

    const { data } = supabase.storage.from("uploads").getPublicUrl(filename);

    // Insert into attachments table
    await supabase.from("attachments").insert({
      user_id: userId,
      feature: req.body.feature || "file",
      url: data.publicUrl,
      content_type: req.file.mimetype,
      size_bytes: req.file.size,
      status: "sent", // Mark as successfully uploaded
    });

    console.log("✅ Upload successful:", data.publicUrl);
    res.json({ url: data.publicUrl });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// --- Ingestion route: records uploaded files so Atlas Brain can process them ---
app.post("/api/ingest", express.json(), async (req, res) => {
  try {
    const { userId, conversationId = null, feature, url, contentType = null, size = null } = req.body;
    if (!userId || !feature || !url) return res.status(400).json({ error: "Missing fields" });

    const { error } = await supabase
      .from("attachments")
      .insert({ 
        user_id: userId, 
        conversation_id: conversationId, 
        feature, 
        url, 
        content_type: contentType, 
        size_bytes: size,
        status: "sent" // Mark as successfully ingested
      });

    if (error) throw error;

    // 👇 Process the file and generate AI response
    console.log("[Ingest] Processing file:", { userId, feature, url });
    
    // Generate appropriate prompt based on file type
    let analysisPrompt = '';
    if (feature === 'audio') {
      analysisPrompt = 'Please analyze this audio recording and provide insights about what was said, the emotional tone, or any other relevant observations.';
    } else if (feature === 'camera' || feature === 'image') {
      analysisPrompt = 'Please analyze this image and describe what you see, including any objects, people, text, or other details that might be relevant.';
    } else if (feature === 'file') {
      analysisPrompt = 'Please analyze this file and provide relevant information about its contents.';
    }

    if (analysisPrompt) {
      // Get user's tier for proper model selection
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      
      const tier = profile?.subscription_tier || 'free';
      
      // Generate AI response for the uploaded file
      try {
        const response = await fetch('http://localhost:3000/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${req.headers.authorization?.replace('Bearer ', '')}`
          },
          body: JSON.stringify({
            userId,
            message: analysisPrompt,
            type: 'file_analysis',
            tier: tier,
            conversationId,
            fileUrl: url,
            fileType: feature
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log("[Ingest] AI analysis completed:", result);
        } else {
          console.error("[Ingest] AI analysis failed:", response.status);
        }
      } catch (aiError) {
        console.error("[Ingest] AI analysis error:", aiError);
      }
    }

    res.json({ ingested: true, processed: true });
  } catch (err) {
    console.error("Ingest error:", err);
    res.status(500).json({ error: "Ingest failed" });
  }
});

// 🚨 Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the process, just log it
});

// 🚨 Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  // Don't crash the process, just log it
});

// --- Audio transcription endpoint ---
app.post('/api/transcribe', verifyJWT, async (req, res) => {
  try {
    const { audioUrl, language = 'en' } = req.body;
    const userId = req.user.id;
    
    console.log('🎤 Transcription request from user:', userId, 'for audio:', audioUrl);
    
    if (!audioUrl) {
      return res.status(400).json({ error: 'Audio URL is required' });
    }
    
    // For now, we'll use a simple mock transcription
    // In production, you would integrate with a real STT service like OpenAI Whisper, Google Speech-to-Text, etc.
    const mockTranscription = {
      transcript: "This is a mock transcription. Please implement a real speech-to-text service for production use.",
      confidence: 0.95,
      language: language,
      duration: 5.2
    };
    
    console.log('✅ Mock transcription completed:', mockTranscription.transcript);
    res.json(mockTranscription);
    
  } catch (error) {
    console.error('❌ Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// Server startup
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Health endpoint available at /healthz`);
  console.log(`🔍 Health: /healthz & /api/healthz ready`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Full health URL: http://0.0.0.0:${PORT}/healthz`);
  console.log(`🎯 NEW: Enhanced Tier Gate System Active!`);
  console.log(`📊 NEW: Admin metrics at /admin/metrics`);
  
  // Start cron jobs
  startWeeklyReportCron();
  
  // Log server startup
  await logInfo("Atlas backend server started with tier gate system", {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    tierGateSystem: 'active',
    cronEnabled: process.env.ENABLE_WEEKLY_REPORTS === 'true',
    timestamp: new Date().toISOString()
  });
});
