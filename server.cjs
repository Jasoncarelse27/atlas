// Minimal Vercel server for health endpoints only
const express = require('express');
const app = express();

// Health endpoints for CI/CD compatibility
app.get('/api/healthz', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    version: '1.0.0',
    service: 'atlas-vercel'
  });
});

app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// Add /healthz endpoint for Railway compatibility
app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    version: '1.0.0',
    service: 'atlas-backend'
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'Atlas Backend Server', status: 'ok' });
});

// Start server when run directly (not when required as module)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Atlas Backend running on port ${PORT}`);
    console.log(`🔍 Health check: http://localhost:${PORT}/healthz`);
    console.log(`🔍 API Health: http://localhost:${PORT}/api/healthz`);
  });
}

module.exports = app;