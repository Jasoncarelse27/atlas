import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in project root
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import express from "express";
import { logError, logInfo, logWarn } from "./utils/logger.mjs";

// 🎯 Import tier gate system (after env vars loaded)
import { createClient } from '@supabase/supabase-js';

// 🛡️ Import new middleware stack
import authMiddleware from "./middleware/authMiddleware.mjs";
import dailyLimitMiddleware from "./middleware/dailyLimitMiddleware.mjs";
import promptCacheMiddleware, { cachePromptResponse } from "./middleware/promptCacheMiddleware.mjs";
import tierGateMiddleware from "./middleware/tierGateMiddleware.mjs";

// Lazy Supabase client for message processing
let supabaseSvc = null;
function getSupabaseClient() {
  if (!supabaseSvc && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseSvc = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return supabaseSvc;
}

const app = express();

// Middleware
app.use(express.json());

// Global auth middleware (except for health endpoints)
app.use((req, res, next) => {
  if (req.path === '/healthz' || req.path === '/api/healthz' || req.path === '/ping') {
    return next();
  }
  return authMiddleware(req, res, next);
});

// Universal health payload
const healthPayload = () => ({
  status: "ok",
  uptime: process.uptime(),
  timestamp: Date.now(),
  version: process.env.npm_package_version || "dev",
  tierGateSystem: "active"
});

// --- Health endpoints ---
app.get("/healthz", async (req, res) => {
  await logInfo("Health check pinged", { env: process.env.NODE_ENV });
  res.status(200).json(healthPayload());
});
app.get("/api/healthz", (req, res) => res.status(200).json(healthPayload()));
app.get("/ping", (req, res) => res.send("pong"));

// --- Enhanced message endpoint with middleware stack ---
app.post("/message", 
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
      const client = getSupabaseClient();
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
