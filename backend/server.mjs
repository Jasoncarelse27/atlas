import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in project root
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import express from "express";

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
app.get("/healthz", (req, res) => res.status(200).json(healthPayload()));
app.get("/api/healthz", (req, res) => res.status(200).json(healthPayload()));
app.get("/ping", (req, res) => res.send("pong"));

// --- Test message endpoint for QA ---
app.post("/message", (req, res) => {
  const { userId, tier, message } = req.body;
  
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
});

// --- Other routes ---
// Load admin routes dynamically after environment variables are set
const { default: adminRoutes } = await import("./routes/admin.js");
app.use("/admin", adminRoutes);
// app.use("/api", yourRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Health: /healthz & /api/healthz ready`);
});