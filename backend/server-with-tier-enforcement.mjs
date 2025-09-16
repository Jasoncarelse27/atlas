import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { createClient } from '@supabase/supabase-js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in project root
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();

// Middleware
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log('✅ [Atlas] Backend Supabase client created with:', supabaseUrl);

// Universal health payload
const healthPayload = () => ({
  status: "ok",
  uptime: process.uptime(),
  timestamp: Date.now(),
  version: process.env.npm_package_version || "dev",
});

// --- Health endpoints ---
app.get("/healthz", (req, res) => res.status(200).json(healthPayload()));
app.get("/api/healthz", (req, res) => res.status(200).json(healthPayload()));
app.get("/ping", (req, res) => res.send("pong"));

// --- Tier Enforcement API Endpoints ---

// Get user tier information
app.get("/api/user/tier-info", async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Call Supabase function to get tier info
    const { data, error } = await supabase
      .rpc('get_user_tier_info', { user_id: userId });

    if (error) {
      console.error('Error getting tier info:', error);
      return res.status(500).json({ error: 'Failed to get tier info' });
    }

    res.json({
      success: true,
      tierInfo: data
    });

  } catch (error) {
    console.error('Error in /api/user/tier-info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send message with server-side tier enforcement
app.post("/api/message", async (req, res) => {
  try {
    const { userId, message, conversationId } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message are required' });
    }

    // 🎯 SERVER-SIDE TIER ENFORCEMENT
    // Check if user can send message (enforces Free tier 15 message limit)
    const { data: allowed, error: limitError } = await supabase
      .rpc('enforce_message_limit', { user_id: userId });

    if (limitError) {
      console.error('Error enforcing message limit:', limitError);
      return res.status(500).json({ error: 'Failed to check message limit' });
    }

    if (!allowed) {
      return res.status(429).json({ 
        error: 'Free tier limit reached. Please upgrade to Core or Studio.',
        code: 'MESSAGE_LIMIT_EXCEEDED',
        tier: 'free',
        limit: 15
      });
    }

    // Get user tier info for model routing
    const { data: tierInfo, error: tierError } = await supabase
      .rpc('get_user_tier_info', { user_id: userId });

    if (tierError) {
      console.error('Error getting tier info:', tierError);
      return res.status(500).json({ error: 'Failed to get tier info' });
    }

    // Route to appropriate Claude model based on tier
    const model = tierInfo.model;
    
    // TODO: Integrate with actual Claude API here
    // For now, return a mock response
    const mockResponse = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: {
        text: `[${model}] I received your message: "${message}". This is a mock response from the server-side tier enforcement system.`
      },
      timestamp: new Date().toISOString(),
      model: model,
      tier: tierInfo.tier
    };

    res.json({
      success: true,
      response: mockResponse,
      tierInfo: {
        tier: tierInfo.tier,
        messagesUsed: tierInfo.messages_used,
        messagesLimit: tierInfo.messages_limit,
        canUseAudio: tierInfo.can_use_audio,
        canUseImage: tierInfo.can_use_image
      }
    });

  } catch (error) {
    console.error('Error in /api/message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check feature access
app.post("/api/feature/check", async (req, res) => {
  try {
    const { userId, feature } = req.body;
    
    if (!userId || !feature) {
      return res.status(400).json({ error: 'userId and feature are required' });
    }

    // Check feature access using Supabase function
    const { data: allowed, error } = await supabase
      .rpc('check_feature_access', { 
        user_id: userId, 
        feature_name: feature 
      });

    if (error) {
      console.error('Error checking feature access:', error);
      return res.status(500).json({ error: 'Failed to check feature access' });
    }

    res.json({
      success: true,
      feature: feature,
      allowed: allowed
    });

  } catch (error) {
    console.error('Error in /api/feature/check:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tier analytics (for admin/monitoring)
app.get("/api/admin/tier-analytics", async (req, res) => {
  try {
    // Get tier analytics from the view we created
    const { data, error } = await supabase
      .from('tier_analytics')
      .select('*');

    if (error) {
      console.error('Error getting tier analytics:', error);
      return res.status(500).json({ error: 'Failed to get tier analytics' });
    }

    res.json({
      success: true,
      analytics: data
    });

  } catch (error) {
    console.error('Error in /api/admin/tier-analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Legacy test endpoint (for backward compatibility) ---
app.post("/message", (req, res) => {
  const { userId, tier, message } = req.body;
  
  // Simulate tier-based model routing
  let model;
  switch (tier) {
    case 'free':
      model = 'claude-3-haiku-20240307';
      break;
    case 'core':
      model = 'claude-3-sonnet-20240229';
      break;
    case 'studio':
      model = 'claude-3-opus-20240229';
      break;
    default:
      model = 'claude-3-haiku-20240307';
  }
  
  res.json({
    success: true,
    userId,
    tier,
    message,
    model,
    timestamp: new Date().toISOString()
  });
});

// --- Other routes ---
// Load admin routes dynamically after environment variables are set
const { default: adminRoutes } = await import("./routes/admin.js");
app.use("/admin", adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 [Atlas] Server running on port ${PORT}`);
  console.log(`🔍 Health: /healthz & /api/healthz ready`);
  console.log(`🎯 Tier Enforcement: /api/message, /api/user/tier-info, /api/feature/check`);
  console.log(`📊 Analytics: /api/admin/tier-analytics`);
});
