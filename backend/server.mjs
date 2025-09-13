import express from "express";
const app = express();

// Universal health payload
const healthPayload = () => ({
  status: "ok",
  uptime: process.uptime(),
  timestamp: Date.now(),
  version: process.env.npm_package_version || "dev",
});

// --- Health endpoints ---
// Primary
app.get("/healthz", (req, res) => {
  res.status(200).json(healthPayload());
});

// Fallback for environments prefixed with /api
app.get("/api/healthz", (req, res) => {
  res.status(200).json(healthPayload());
});

// Optional: simple ping
app.get("/ping", (req, res) => res.send("pong"));

// --- Your other routes go here ---
// app.use("/api", yourRouter);

// --- Server listen ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Health checks ready at:`);
  console.log(`   • http://localhost:${PORT}/healthz`);
  console.log(`   • http://localhost:${PORT}/api/healthz`);
});
