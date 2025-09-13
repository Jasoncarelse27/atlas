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

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'Atlas Vercel API Server', status: 'ok' });
});

module.exports = app;