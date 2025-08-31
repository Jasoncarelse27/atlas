import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.NOVA_BACKEND_PORT || 8000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint for wait-on
app.get('/healthz', (req, res) => {
  res.json({ 
    backend: "ok",
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Proxy to Python Nova backend if it exists
let pythonProcess = null;

const startPythonBackend = async () => {
  const pythonServerPath = path.join(__dirname, '..', 'server.py');
  
  try {
    // Check if Python server exists
    const fs = await import('node:fs');
    if (fs.existsSync(pythonServerPath)) {
      console.log('🐍 Starting Python Nova backend...');
      pythonProcess = spawn('python', [pythonServerPath], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      pythonProcess.on('error', (error) => {
        console.error('❌ Failed to start Python backend:', error);
      });
      
      pythonProcess.on('exit', (code) => {
        console.log(`🐍 Python backend exited with code ${code}`);
      });
    } else {
      console.log('⚠️ Python server.py not found, running Node-only mode');
    }
  } catch (error) {
    console.error('❌ Error checking Python backend:', error);
  }
};

// API routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    backend: 'node',
    python_backend: pythonProcess ? 'running' : 'not_found'
  });
});

// Fallback route - serve the main HTML file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  if (pythonProcess) {
    console.log('🐍 Terminating Python backend...');
    pythonProcess.kill('SIGTERM');
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Nova Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🌐 Main app: http://localhost:${PORT}`);
  
  // Start Python backend if available
  await startPythonBackend();
});
