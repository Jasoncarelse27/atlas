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
app.get("/healthz", (req, res) => res.status(200).json(healthPayload()));
app.get("/api/healthz", (req, res) => res.status(200).json(healthPayload()));
app.get("/ping", (req, res) => res.send("pong"));

// --- Other routes ---
// app.use("/api", yourRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Health: /healthz & /api/healthz ready`);
});