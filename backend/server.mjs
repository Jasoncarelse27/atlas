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

// Load environment variables from the appropriate .env file
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

// 🛡️ Import new middleware stack
import authMiddleware from "./middleware/authMiddleware.mjs";
import dailyLimitMiddleware from "./middleware/dailyLimitMiddleware.mjs";
import promptCacheMiddleware, { cachePromptResponse } from "./middleware/promptCacheMiddleware.mjs";
import tierGateMiddleware from "./middleware/tierGateMiddleware.mjs";

const app = express();

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

// 🚦 Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
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
    "http://localhost:5173", 
    "http://192.168.0.10:5173",
    /^https:\/\/atlas-.*\.vercel\.app$/,
    /^https:\/\/atlas.*\.up\.railway\.app$/,
    /^https:\/\/.*\.railway\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options("*", cors());

// Global auth middleware (except for health endpoints and paddle test)
app.use((req, res, next) => {
  if (req.path === '/healthz' || req.path === '/api/healthz' || req.path === '/ping' || req.path === '/admin/paddle-test') {
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

// --- Enhanced message endpoint with middleware stack ---
app.post("/message", 
  messageLimiter, // Apply message-specific rate limiting
  dailyLimitMiddleware,
  tierGateMiddleware, 
  promptCacheMiddleware,
  async (req, res) => {
    try {
      const { userId, message, type = 'chat', promptType } = req.body;
      
      // All tier enforcement, budget checks, and model selection done by middleware
      const tier = req.tier;
      const selectedModel = req.selectedModel;
      const cachedPrompt = req.cachedPrompt;
      const dailyUsage = req.dailyUsage;
      const budgetStatus = req.budgetStatus;
      const cacheStats = req.cacheStats;
      
      await logInfo("Message API called (middleware-processed)", { 
        userId, 
        tier, 
        hasMessage: !!message,
        model: selectedModel?.name,
        dailyUsage: dailyUsage?.count,
        cacheHit: cacheStats?.hit
      });

      // 🤖 STEP 1: Use cached prompt or generate system prompt
      let systemPrompt = cachedPrompt?.content || 
        `You are Atlas, an emotionally intelligent AI assistant focused on emotional wellbeing and mental health support.`;

      // 🤖 STEP 2: Enhanced AI processing simulation
      const mockResponse = `[${selectedModel?.name || 'claude-3-haiku-20240307'}] I understand you're reaching out. ` + 
        (tier === 'studio' ? 'As a Studio user, you get my most advanced emotional analysis. ' : '') +
        (tier === 'core' ? 'As a Core user, you have access to comprehensive emotional support. ' : '') +
        `Here's how I can help with: "${message?.substring(0, 50)}..."`;

      // 📊 STEP 3: Calculate actual token usage
      const inputTokens = (systemPrompt.length + (message?.length || 0)) / 4; // Rough estimate
      const outputTokens = mockResponse.length / 4;
      const totalTokens = Math.round(inputTokens + outputTokens);

      // 💾 STEP 4: Cache prompt response if needed
      if (cachedPrompt && !cachedPrompt.cacheHit && cachedPrompt.shouldCache) {
        await cachePromptResponse(
          cachedPrompt.cacheKey, 
          systemPrompt, 
          Math.round(inputTokens), 
          cachedPrompt.type
        );
      }

      // 📊 STEP 5: Update actual usage with real token counts
      const { supabase: client } = await import('./config/supabaseClient.mjs');
      if (client && userId) {
        // Update daily usage with actual tokens
        await client.rpc('increment_conversation_count', {
          p_user_id: userId,
          p_tier: tier,
          p_tokens_used: totalTokens,
          p_cost_estimate: selectedModel?.estimatedCost || 0
        });
      }

      await logInfo("Message processed successfully", { 
        tier, 
        selectedModel: selectedModel?.name, 
        estimatedCost: selectedModel?.estimatedCost?.toFixed(6) || '0.000000',
        totalTokens,
        cacheHit: cacheStats?.hit,
        dailyUsage: `${dailyUsage?.count}/${dailyUsage?.limit === -1 ? '∞' : dailyUsage?.limit}`
      });

      res.json({
        success: true,
        response: mockResponse,
        metadata: {
          tier,
          model: selectedModel?.name,
          tokensUsed: totalTokens,
          estimatedCost: selectedModel?.estimatedCost?.toFixed(6) || '0.000000',
          budgetStatus: {
            used: budgetStatus?.used,
            limit: budgetStatus?.limit,
            remaining: budgetStatus?.remaining
          },
          dailyUsage: {
            count: dailyUsage?.count,
            limit: dailyUsage?.limit,
            unlimited: dailyUsage?.unlimited
          },
          cache: {
            hit: cacheStats?.hit,
            type: cacheStats?.type,
            savings: cacheStats?.savings
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      await logError("Message API error", error.stack, { 
        userId: req.body?.userId, 
        tier: req.tier || req.body?.tier,
        endpoint: '/message'
      });
      
      res.status(500).json({
        success: false,
        error: "Internal server error",
        timestamp: new Date().toISOString()
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
  
  // Log server startup
  await logInfo("Atlas backend server started with tier gate system", {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    tierGateSystem: 'active',
    timestamp: new Date().toISOString()
  });
});
