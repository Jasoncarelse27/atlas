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

const app = express();

// Middleware
app.use(express.json());

// Universal health payload
const healthPayload = () => ({
  status: "ok",
  uptime: process.uptime(),
  timestamp: Date.now(),
  version: process.env.npm_package_version || "dev",
});

// --- Health endpoints ---
app.get("/healthz", async (req, res) => {
  await logInfo("Health check pinged", { env: process.env.NODE_ENV });
  res.status(200).json(healthPayload());
});
app.get("/api/healthz", (req, res) => res.status(200).json(healthPayload()));
app.get("/ping", (req, res) => res.send("pong"));

// --- Test message endpoint for QA ---
app.post("/message", async (req, res) => {
  try {
    const { userId, tier, message } = req.body;
    
    // Log message attempt
    await logInfo("Message API called", { userId, tier, hasMessage: !!message });
    
    // Simulate tier-based model routing
    let model;
    switch (tier) {
      case 'free':
        model = 'claude-3-haiku';
        break;
      case 'core':
        model = 'claude-3-sonnet';
        break;
      case 'studio':
        model = 'claude-3-opus';
        break;
      default:
        model = 'claude-3-haiku';
    }
  
    res.json({
      success: true,
      userId,
      tier,
      message,
      model,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log error to Supabase
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
// app.use("/api", yourRouter);

// Catch-all route for debugging Railway deployment
app.get('*', (req, res) => {
  console.log(`🔍 Unmatched route: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes: ['/healthz', '/api/healthz', '/ping', '/message', '/admin/*']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Health endpoint available at /healthz`);
  console.log(`🔍 Health: /healthz & /api/healthz ready`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Full health URL: http://0.0.0.0:${PORT}/healthz`);
  
  // Log server startup
  await logInfo("Atlas backend server started", {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});