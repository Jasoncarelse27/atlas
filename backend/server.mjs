import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || process.env.NOVA_BACKEND_PORT || 8000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['*']
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint for Railway
app.get('/healthz', (req, res) => {
  res.json({ 
    status: 'healthy',
    backend: "ok",
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Test ping endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Atlas backend is alive!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    backend: 'node'
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    message: 'Atlas Backend API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files (if any)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback route - serve a simple status page
app.get('*', (req, res) => {
  res.json({
    message: 'Atlas Backend Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/healthz',
      ping: '/ping',
      api_health: '/api/health',
      api_status: '/api/status'
    }
  });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Atlas Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🏓 Ping test: http://localhost:${PORT}/ping`);
  console.log(`🌐 API status: http://localhost:${PORT}/api/status`);
});
