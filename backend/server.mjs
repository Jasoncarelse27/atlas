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
import { budgetCeilingService } from "./services/budgetCeilingService.mjs";
import { promptCacheService } from "./services/promptCacheService.mjs";
import { selectOptimalModel, estimateRequestCost } from "./config/intelligentTierSystem.mjs";
import { createClient } from '@supabase/supabase-js';

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

// --- Enhanced message endpoint with tier gate system ---
app.post("/message", async (req, res) => {
  try {
    const { userId, tier = 'free', message, type = 'chat' } = req.body;
    
    await logInfo("Message API called", { userId, tier, hasMessage: !!message });
    
    // 🎯 STEP 1: Check budget ceiling (NEW)
    const budgetCheck = await budgetCeilingService.checkBudgetCeiling(tier);
    if (!budgetCheck.allowed) {
      await logWarn("Request blocked by budget ceiling", { tier, message: budgetCheck.message });
      return res.status(429).json({ 
        success: false,
        message: budgetCheck.message, 
        upgrade: tier === 'free',
        budgetInfo: {
          priorityOverride: budgetCheck.priorityOverride
        }
      });
    }

    // 🧠 STEP 2: Intelligent model selection (NEW)
    const selectedModel = selectOptimalModel(tier, message, type);
    await logInfo("Model selected", { tier, selectedModel, messageLength: message?.length });

    // 💾 STEP 3: Get cached system prompt (NEW)
    const systemPrompt = await promptCacheService.get(
      'systemPersonality', 
      { userId, tier }, 
      `You are Atlas, an emotionally intelligent AI assistant focused on emotional wellbeing and mental health support.`
    );

    // 🤖 STEP 4: Enhanced AI processing simulation
    const mockResponse = `[${selectedModel}] I understand you're reaching out. ` + 
      (tier === 'studio' ? 'As a Studio user, you get my most advanced emotional analysis. ' : '') +
      (tier === 'core' ? 'As a Core user, you have access to comprehensive emotional support. ' : '') +
      `Here's how I can help with: "${message?.substring(0, 50)}..."`;

    // 📊 STEP 5: Log usage and costs (NEW)
    const inputTokens = (systemPrompt.length + (message?.length || 0)) / 4; // Rough estimate
    const outputTokens = mockResponse.length / 4;
    const estimatedCost = estimateRequestCost(selectedModel, inputTokens, outputTokens);

    // Log model usage for dashboard
    const client = getSupabaseClient();
    if (client) {
      await client.rpc('log_model_usage', {
        p_date: new Date().toISOString().slice(0,10),
        p_model: selectedModel,
        p_tier: tier,
        p_cost: estimatedCost
      });
    }

    // Update budget tracking
    await budgetCeilingService.recordSpend(tier, estimatedCost, 1);

    await logInfo("Message processed successfully", { 
      tier, 
      selectedModel, 
      estimatedCost: estimatedCost.toFixed(6),
      inputTokens: Math.round(inputTokens),
      outputTokens: Math.round(outputTokens)
    });

    res.json({
      success: true,
      response: mockResponse,
      metadata: {
        tier,
        model: selectedModel,
        tokensUsed: Math.round(inputTokens + outputTokens),
        estimatedCost: estimatedCost.toFixed(6),
        budgetStatus: budgetCheck.priorityOverride ? 'priority_processing' : 'normal',
        systemPromptCached: true,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    await logError("Message API error", error.stack, { 
      userId: req.body?.userId, 
      tier: req.body?.tier,
      endpoint: '/message'
    });
    
    res.status(500).json({
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString()
    });
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
