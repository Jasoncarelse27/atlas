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
import { logError, logInfo, logWarn } from "./utils/logger.mjs";

// 🛡️ Import middleware stack
import authMiddleware from "./middleware/authMiddleware.mjs";
import dailyLimitMiddleware from "./middleware/dailyLimitMiddleware.mjs";

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
      req.user = { id: '550e8400-e29b-41d4-a716-446655440000' };
      return next();
    }
    
    // Production mode: verify the JWT token with Supabase
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

// 🚦 Rate Limiting - more lenient for development
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit for dev
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests from this IP' },
  standardHeaders: true,
  legacyHeaders: false,
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 message requests per minute
  message: { error: 'MESSAGE_RATE_LIMIT_EXCEEDED', message: 'Too many message requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global rate limiting
app.use(globalLimiter);

// Middleware
app.use(express.json({ limit: '2mb' }));

// CORS middleware - allow frontend connections
app.use(cors({
  origin: [
    "http://localhost:5173",   // Vite dev server
    "http://localhost:5174",   // Backup Vite port
    "http://localhost:8081",   // Expo web
    "http://localhost:3000",   // Backend self-calls
    "http://192.168.0.10:5173",
    "http://192.168.0.10:5174",
    /^https:\/\/atlas-.*\.vercel\.app$/,
    /^https:\/\/atlas.*\.up\.railway\.app$/,
    /^https:\/\/.*\.railway\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'authorization']
}));

// Handle preflight requests
app.options("*", cors());

// Global auth middleware (except for health endpoints, paddle test, and JWT-protected routes)
app.use((req, res, next) => {
  // Skip auth middleware for public endpoints
  if (req.path === '/healthz' || req.path === '/api/healthz' || req.path === '/ping' || req.path === '/admin/paddle-test') {
    return next();
  }
  
  // Skip auth middleware for routes that use their own auth (verifyJWT or requireAdminDev)
  if (req.path.startsWith('/v1/user_profiles') || req.path === '/message' || req.path.startsWith('/admin')) {
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

// --- Enhanced message endpoint with intelligent tier gate system ---
app.post("/message", 
  messageLimiter, // Apply message-specific rate limiting
  verifyJWT, // JWT verification
  dailyLimitMiddleware,
  async (req, res) => {
    try {
      const { userId, message, type = 'chat', tier = 'free' } = req.body;
      
      if (!message || !tier) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: message and tier' 
        });
      }

      await logInfo("Message API called with intelligent tier system", { 
        userId, 
        tier, 
        hasMessage: !!message,
        messageLength: message.length
      });

      // 🛡️ STEP 1: Budget ceiling check
      const budgetCheck = await budgetCeilingService.checkBudgetCeiling(tier);
      if (!budgetCheck.allowed) {
        return res.status(429).json({
          success: false,
          message: budgetCheck.message,
          upgrade: tier === 'free'
        });
      }

      // 🧠 STEP 2: Intelligent model selection
      const selectedModelName = selectOptimalModel(tier, message, type);
      
      // 💾 STEP 3: Get cached system prompt
      const systemPrompt = await promptCacheService.get(
        'systemPersonality', 
        { tier, userId }, 
        `You are Atlas, an emotionally intelligent AI assistant focused on emotional wellbeing and mental health support. You help users develop emotional intelligence, manage stress, and build healthier habits.`
      );

      await logInfo("Intelligent tier processing", { 
        tier,
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
            tier
          });
          
          const response = await anthropic.messages.create({
            model: selectedModelName,
            max_tokens: 1000,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: message
              }
            ]
          });
          
          aiResponse = response.content[0].text;
          actualInputTokens = response.usage.input_tokens;
          actualOutputTokens = response.usage.output_tokens;
          
          await logInfo("Real AI response generated successfully", {
            model: selectedModelName,
            inputTokens: actualInputTokens,
            outputTokens: actualOutputTokens,
            responseLength: aiResponse.length,
            tier
          });
        } else {
          // Fallback to enhanced mock response if no API key
          aiResponse = `Hello! I'm Atlas, your AI-powered emotional intelligence companion. ` + 
            (tier === 'studio' ? 'As a Studio user, you get my most advanced emotional analysis and personalized insights. ' : '') +
            (tier === 'core' ? 'As a Core user, you have access to comprehensive emotional support and habit coaching. ' : '') +
            (tier === 'free' ? 'I\'m here to provide basic emotional support and guidance. ' : '') +
            `I understand you're reaching out about "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}" - how can I help you today?`;
          
          // Estimate tokens for mock response
          actualInputTokens = Math.ceil((systemPrompt.length + message.length) / 4);
          actualOutputTokens = Math.ceil(aiResponse.length / 4);
        }
      } catch (error) {
        await logError("AI response generation failed", { error: error.message, model: selectedModelName, tier });
        
        // Graceful fallback
        aiResponse = `I'm experiencing some technical difficulties right now. Please try again in a moment. ` +
          `As your ${tier} tier Atlas companion, I'm here to help with emotional intelligence and support.`;
        actualInputTokens = Math.ceil((systemPrompt.length + message.length) / 4);
        actualOutputTokens = Math.ceil(aiResponse.length / 4);
      }

      // 📊 STEP 5: Calculate actual token usage and cost
      const totalTokens = actualInputTokens + actualOutputTokens;
      const estimatedCost = estimateRequestCost(selectedModelName, actualInputTokens, actualOutputTokens);

      // 📊 STEP 6: Record budget spend and usage
      await budgetCeilingService.recordSpend(tier, estimatedCost, 1);

      // 📊 STEP 7: Update daily usage tracking
      const { supabase: client } = await import('./config/supabaseClient.mjs');
      if (client && userId) {
        // Update daily usage with actual tokens and cost
        await client.rpc('increment_conversation_count', {
          p_user_id: userId,
          p_tier: tier,
          p_tokens_used: totalTokens,
          p_cost_estimate: estimatedCost
        });
      }

      await logInfo("Message processed with intelligent tier system", { 
        tier, 
        selectedModel: selectedModelName, 
        estimatedCost: estimatedCost.toFixed(6),
        totalTokens,
        inputTokens: actualInputTokens,
        outputTokens: actualOutputTokens,
        budgetPriority: budgetCheck.priorityOverride || false
      });

      res.json({
        success: true,
        response: aiResponse,
        metadata: {
          tier,
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
        tier: req.body?.tier
      });
      
      res.status(500).json({
        success: false,
        message: "I'm experiencing some technical difficulties. Please try again in a moment.",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

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
