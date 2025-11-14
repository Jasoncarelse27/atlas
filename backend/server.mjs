import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import http from 'http';
import https from 'https';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { selectOptimalModel } from './config/intelligentTierSystem.mjs';
import { flushSentry, getSentryMiddleware, initSentry } from './lib/sentryService.mjs';
import { logger } from './lib/simpleLogger.mjs';
import authMiddleware from './middleware/authMiddleware.mjs';
import { apiCacheMiddleware, cacheTierMiddleware, invalidateCacheMiddleware } from './middleware/cacheMiddleware.mjs';
import dailyLimitMiddleware from './middleware/dailyLimitMiddleware.mjs';
import { imageAnalysisRateLimit, messageRateLimit } from './middleware/rateLimitMiddleware.mjs';
import tierGateMiddleware from './middleware/tierGateMiddleware.mjs';
import { processMessage } from './services/messageService.js';
import { redisService } from './services/redisService.mjs';
import { createQueryTimeout } from './utils/queryTimeout.mjs';

// ✅ CRITICAL: Handle uncaught exceptions and rejections
// This prevents Railway from killing the container on unhandled errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit - let Railway handle it, but log the error
  // Exiting here causes Railway to see container as crashed
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let Railway handle it, but log the error
});

// ✅ SCALABILITY FIX: Increased connection pool for 10k+ users
// At 10k users: 200 connections × 2 req/sec = 400 req/sec capacity (20% headroom)
const httpAgent = new http.Agent({ 
  keepAlive: true,
  maxSockets: 200, // ✅ Increased from 50 to handle 10k concurrent users
  maxFreeSockets: 50, // ✅ Increased from 10 for better connection reuse
  timeout: 30000 // 30s timeout
});
const httpsAgent = new https.Agent({ 
  keepAlive: true,
  maxSockets: 200, // ✅ Increased from 50 to handle 10k concurrent users
  maxFreeSockets: 50, // ✅ Increased from 10 for better connection reuse
  timeout: 30000 // 30s timeout
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load environment variables from .env file (root of atlas/)
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });
logger.info(`[Server] Loading .env from: ${envPath}`);

// ✅ Validate Claude API key is loaded
if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
  logger.warn('⚠️  WARNING: No Claude API key found in environment!');
  logger.warn('   Voice calls and chat will fail. Add ANTHROPIC_API_KEY to .env');
}

// ✅ Automatic port cleanup to prevent EADDRINUSE errors
// Skip on Railway (PORT is set by Railway, not 8000)
if (!process.env.RAILWAY_ENVIRONMENT && !process.env.PORT) {
  try {
    execSync("lsof -ti:8000 | xargs kill -9", { stdio: "ignore" });
    logger.debug("🧹 Port 8000 cleared successfully ✅");
  } catch (e) {
    logger.debug("🧹 Port 8000 is already clear ✅");
  }
}

const app = express();

// Track server readiness
let serverReady = false;

// Health check endpoint - register IMMEDIATELY before any middleware
// This ensures Railway can reach it even during server initialization
// ✅ SCALABILITY FIX: Enhanced health check for monitoring at scale
// ✅ RAILWAY FIX: Fast health check - respond immediately, check DB/Redis in parallel
// ✅ CI FIX: Synchronous checks in CI/test environments for validation
app.get('/healthz', async (req, res) => {
  // ✅ CI FIX: Detect CI/test environment - wait synchronously for checks
  // GitHub Actions automatically sets CI=true, and workflow sets NODE_ENV=test
  // Check for any CI indicator (more lenient detection)
  const isCI = !!process.env.CI || 
               !!process.env.GITHUB_ACTIONS ||
               process.env.NODE_ENV === 'test' ||
               process.env.CI === 'true' ||
               process.env.GITHUB_ACTIONS === 'true';
  
  // ✅ DEBUG: Always log environment detection for troubleshooting
  logger.debug(`[HealthCheck] Environment check: CI=${process.env.CI}, GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS}, NODE_ENV=${process.env.NODE_ENV}, isCI=${isCI}`);
  
  // ✅ CONNECTION MONITORING: Calculate connection pool metrics
  const getConnectionMetrics = () => {
    const httpActive = httpAgent.sockets ? Object.keys(httpAgent.sockets).length : 0;
    const httpsActive = httpsAgent.sockets ? Object.keys(httpsAgent.sockets).length : 0;
    const totalActive = httpActive + httpsActive;
    const maxConnections = 200; // HTTP + HTTPS combined limit
    const utilizationPercent = (totalActive / maxConnections) * 100;
    const supabaseMaxConnections = 3000; // Pro plan
    const supabaseUtilization = (totalActive / supabaseMaxConnections) * 100;
    
    // Log warning if >80% utilized
    if (utilizationPercent > 80) {
      logger.warn(`⚠️ [ConnectionPool] At ${utilizationPercent.toFixed(1)}% capacity`, {
        active: totalActive,
        max: maxConnections,
        http: httpActive,
        https: httpsActive,
        supabaseUtilization: `${supabaseUtilization.toFixed(2)}%`
      });
    }
    
    return {
      http: { active: httpActive, max: 200, utilization: (httpActive / 200) * 100 },
      https: { active: httpsActive, max: 200, utilization: (httpsActive / 200) * 100 },
      total: { active: totalActive, max: maxConnections, utilization: utilizationPercent },
      supabase: {
        plan: 'Pro',
        maxConnections: supabaseMaxConnections,
        utilization: supabaseUtilization,
        available: supabaseMaxConnections - totalActive
      },
      status: utilizationPercent > 90 ? 'critical' : utilizationPercent > 80 ? 'warning' : 'healthy'
    };
  };
  
  const connectionMetrics = getConnectionMetrics();

  // ✅ TIER MONITORING: Get tier distribution (non-blocking, async)
  const getTierMetrics = async (timeoutMs = 2000) => {
    try {
      const { supabase } = await import('./config/supabaseClient.mjs');
      const querySignal = createQueryTimeout(timeoutMs);
      
      // Get tier distribution from profiles (efficient single query)
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .abortSignal(querySignal);
      
      if (error) {
        logger.debug('[HealthCheck] Tier metrics query failed:', error.message);
        return {
          free: 0,
          core: 0,
          studio: 0,
          total: 0,
          status: 'error',
          error: error.message
        };
      }
      
      // Count tiers efficiently
      const tierCounts = { free: 0, core: 0, studio: 0 };
      (profiles || []).forEach(profile => {
        const tier = profile?.subscription_tier || 'free';
        if (tier === 'free' || tier === 'core' || tier === 'studio') {
          tierCounts[tier]++;
        }
      });
      
      const total = tierCounts.free + tierCounts.core + tierCounts.studio;
      
      return {
        free: tierCounts.free,
        core: tierCounts.core,
        studio: tierCounts.studio,
        total: total,
        distribution: total > 0 ? {
          free: ((tierCounts.free / total) * 100).toFixed(1) + '%',
          core: ((tierCounts.core / total) * 100).toFixed(1) + '%',
          studio: ((tierCounts.studio / total) * 100).toFixed(1) + '%'
        } : { free: '0%', core: '0%', studio: '0%' },
        status: 'ok'
      };
    } catch (error) {
      logger.debug('[HealthCheck] Tier metrics error:', error.message);
      return {
        free: 0,
        core: 0,
        studio: 0,
        total: 0,
        status: 'error',
        error: error.message
      };
    }
  };

  // Initialize tier metrics promise (non-blocking)
  const tierMetricsPromise = getTierMetrics(isCI ? 3000 : 2000);

  const health = {
    status: serverReady ? 'ok' : 'starting',
    timestamp: Date.now(),
    uptime: process.uptime(),
    ready: serverReady,
    serverState: serverReady ? 'ready' : 'starting',
    checks: {
      database: 'pending',
      redis: 'pending',
      connections: connectionMetrics, // ✅ CONNECTION MONITORING: Added
      tiers: { free: 0, core: 0, studio: 0, total: 0, status: 'pending' }, // ✅ TIER MONITORING: Added
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        limit: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    },
  };

  // ✅ CI FIX: In CI/test, wait synchronously for checks (max 5s)
  if (isCI) {
    try {
      const [dbHealthy, redisHealthy, tierMetrics] = await Promise.all([
        // Database check (with timeout)
        (async () => {
          try {
            const { supabase } = await import('./config/supabaseClient.mjs');
            const querySignal = createQueryTimeout(3000); // 3s timeout for CI
            const { error } = await supabase
              .from('profiles')
              .select('id')
              .abortSignal(querySignal)
              .limit(1);
            return !error;
          } catch (error) {
            logger.debug('[HealthCheck] Database check failed:', error.message);
            return false;
          }
        })(),
        // Redis check (with timeout)
        (async () => {
          if (!redisService) {
            logger.debug('[HealthCheck] Redis service not initialized');
            return false;
          }
          try {
            // ✅ CI FIX: Wait for Redis connection with longer timeout (Redis might need time to connect)
            const redisHealthy = await Promise.race([
              redisService.healthCheck(),
              new Promise((resolve) => setTimeout(() => {
                logger.debug('[HealthCheck] Redis check timeout after 5s');
                resolve(false);
              }, 5000)) // 5s timeout for CI
            ]);
            logger.debug(`[HealthCheck] Redis check result: ${redisHealthy}`);
            return redisHealthy;
          } catch (error) {
            logger.debug('[HealthCheck] Redis check failed:', error.message);
            return false;
          }
        })(),
        // Tier metrics (non-blocking)
        tierMetricsPromise
      ]);

      health.checks.database = dbHealthy;
      health.checks.redis = redisHealthy;
      health.checks.tiers = tierMetrics; // ✅ TIER MONITORING: Add tier metrics
      
      // ✅ CI FIX: Return boolean values for CI script parsing
      const isHealthy = serverReady && (dbHealthy || process.env.NODE_ENV === 'test'); // DB optional in test
      
      res.status(isHealthy ? 200 : 503).json({
        ...health,
        // ✅ CI FIX: Add boolean fields for CI script compatibility
        database: dbHealthy,
        redis: redisHealthy,
      });
    } catch (error) {
      logger.debug('[HealthCheck] CI check error:', error.message);
      res.status(503).json({
        ...health,
        database: false,
        redis: false,
        error: error.message,
      });
    }
  } else {
    // ✅ RAILWAY FIX: Production - wait for tier metrics (fast, non-blocking)
    // Wait for tier metrics with timeout before responding (max 1.5s)
    try {
      const tierMetrics = await Promise.race([
        tierMetricsPromise,
        new Promise((resolve) => setTimeout(() => {
          logger.debug('[HealthCheck] Tier metrics timeout, using defaults');
          resolve({
            free: 0,
            core: 0,
            studio: 0,
            total: 0,
            status: 'timeout',
            error: 'Query timeout'
          });
        }, 1500)) // 1.5s timeout for production
      ]);
      
      health.checks.tiers = tierMetrics; // ✅ TIER MONITORING: Add tier metrics
    } catch (error) {
      logger.debug('[HealthCheck] Tier metrics error:', error.message);
      health.checks.tiers = {
        free: 0,
        core: 0,
        studio: 0,
        total: 0,
        status: 'error',
        error: error.message
      };
    }

    // Database and Redis checks run async (non-blocking for response)
    Promise.all([
      // Database check (with timeout)
      (async () => {
        try {
          const { supabase } = await import('./config/supabaseClient.mjs');
          const querySignal = createQueryTimeout(2000); // 2s timeout (faster for Railway)
          const { error } = await supabase
            .from('profiles')
            .select('id')
            .abortSignal(querySignal)
            .limit(1);
          return !error;
        } catch (error) {
          logger.debug('[HealthCheck] Database check failed:', error.message);
          return false;
        }
      })(),
      // Redis check (with timeout)
      (async () => {
        if (!redisService) return false;
        try {
          return await Promise.race([
            redisService.healthCheck(),
            new Promise((resolve) => setTimeout(() => resolve(false), 1000)) // 1s timeout
          ]);
        } catch (error) {
          logger.debug('[HealthCheck] Redis check failed:', error.message);
          return false;
        }
      })()
    ]).then(([dbHealthy, redisHealthy]) => {
      // Update health object (for monitoring, but response already sent)
      health.checks.database = dbHealthy;
      health.checks.redis = redisHealthy;
    }).catch(() => {
      // Ignore errors - health check already responded
    });

    // ✅ RAILWAY FIX: Return 200 immediately if server is ready (with tier metrics)
    const isHealthy = serverReady;
    res.status(isHealthy ? 200 : 503).json(health);
  }
});

// Initialize Sentry error tracking
initSentry(app);

// Get Sentry middleware
const sentryMiddleware = getSentryMiddleware();

// ✅ Detect your machine's local IP for LAN (mobile) access
const getLocalIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return process.env.HOST_IP || "localhost";
};

const LOCAL_IP = getLocalIPAddress();
const PORT = process.env.PORT || process.env.NOVA_BACKEND_PORT || 8000;

// ✅ PERFORMANCE FIX: Startup validation - log model configuration to verify correct models
if (process.env.NODE_ENV !== 'test') {
  logger.info('[Server] Model configuration:', {
    free: selectOptimalModel('free', '', 'startup'),
    core: selectOptimalModel('core', '', 'startup'),
    studio: selectOptimalModel('studio', '', 'startup')
  });
}

// Log port immediately for Railway debugging
console.log(`🔧 Server starting on PORT=${PORT} (from env: ${process.env.PORT || 'not set'})`);
logger.info(`[Server] Starting on port ${PORT}`);

// 🔒 SECURITY: Initialize Supabase client - ALWAYS require real credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase;
try {
  // ✅ SECURITY FIX: Removed mock Supabase client - ALWAYS require real credentials
  // This prevents authentication bypass and ensures proper database security
  
  if (!supabaseUrl || !supabaseServiceKey) {
    logger.error('❌ FATAL: Missing Supabase credentials');
    logger.error('   Required: VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
    logger.error('   Add these to Railway environment variables to fix deployment');
    process.exit(1);
  }
  
  // Always use real Supabase client with proper credentials
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  logger.debug('✅ Supabase client initialized successfully');
} catch (error) {
  logger.error('❌ FATAL: Failed to initialize Supabase client:', error.message);
  process.exit(1);
}

// External AI API keys
// ✅ CRITICAL FIX: Trim whitespace and validate API key format
// ✅ RAILWAY FIX: Check all possible variable names and log what's available
logger.info('[Server] 🔍 Environment variable check:', {
  'process.env.ANTHROPIC_API_KEY': !!process.env.ANTHROPIC_API_KEY,
  'process.env.CLAUDE_API_KEY': !!process.env.CLAUDE_API_KEY,
  'process.env.VITE_CLAUDE_API_KEY': !!process.env.VITE_CLAUDE_API_KEY,
  'process.env keys count': Object.keys(process.env).length,
  'sample env keys': Object.keys(process.env).filter(k => k.includes('ANTHROPIC') || k.includes('CLAUDE')).join(', ') || 'none',
  'all env keys (first 20)': Object.keys(process.env).slice(0, 20).join(', ')
});

let ANTHROPIC_API_KEY = (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.VITE_CLAUDE_API_KEY)?.trim();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ✅ CRITICAL FIX: Validate API key format
// ✅ CI FIX: Allow mock keys in test/CI environments
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true' || process.env.CI === true;
if (ANTHROPIC_API_KEY && !ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
  if (isTestEnv) {
    logger.debug(`[Server] ✅ Test environment detected (NODE_ENV=${process.env.NODE_ENV}, CI=${process.env.CI}, GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS}) - allowing mock API key`);
  } else {
    logger.error(`[Server] ⚠️ ANTHROPIC_API_KEY format invalid - should start with 'sk-ant-' but starts with '${ANTHROPIC_API_KEY.substring(0, 8)}...'`);
    logger.error(`[Server] ⚠️ Full key length: ${ANTHROPIC_API_KEY.length} characters`);
    // Don't fail hard - let it try and log the error from API
  }
}

// 🔍 DEBUG: Log API key status
logger.info('[Server] API Keys loaded:', {
  ANTHROPIC_API_KEY: ANTHROPIC_API_KEY ? `✅ Set (${ANTHROPIC_API_KEY.substring(0, 8)}...)` : '❌ Missing',
  ANTHROPIC_API_KEY_LENGTH: ANTHROPIC_API_KEY?.length || 0,
  OPENAI_API_KEY: OPENAI_API_KEY ? `✅ Set (${OPENAI_API_KEY.substring(0, 8)}...)` : '❌ Missing'
});

// Initialize AI clients
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Log API key availability
logger.debug(`  Claude/Anthropic: ${ANTHROPIC_API_KEY ? '✅ Available' : '❌ Missing'}`);
logger.debug(`  OpenAI (Whisper + TTS): ${OPENAI_API_KEY ? '✅ Available' : '❌ Missing'}`);
if (!ANTHROPIC_API_KEY) {
  logger.error('⚠️ [Server] ANTHROPIC_API_KEY is missing - AI features will not work');
}

// ✅ DEPRECATED: Use selectOptimalModel from intelligentTierSystem.mjs instead
// This function is kept for backward compatibility but delegates to selectOptimalModel
const _mapTierToAnthropicModel = (tier) => {
  // ✅ FIX: Use centralized selectOptimalModel function (DRY principle)
  // This ensures consistent model selection across all endpoints
  return selectOptimalModel(tier, '', 'legacy_mapping');
};

// ✅ STARTUP VERIFICATION: Verify Anthropic API key and model before starting server
async function verifyAnthropicConfig() {
  // ✅ CI FIX: Skip verification in test/CI environments with mock keys
  // GitHub Actions sets CI=true automatically, and workflow sets NODE_ENV=test
  const isTestEnv = process.env.NODE_ENV === 'test' || 
                    process.env.CI === 'true' || 
                    process.env.CI === true ||
                    process.env.GITHUB_ACTIONS === 'true' || 
                    process.env.GITHUB_ACTIONS === true;
  
  // ✅ DEBUG: Log environment detection
  logger.debug(`[verifyAnthropicConfig] Environment check: NODE_ENV=${process.env.NODE_ENV}, CI=${process.env.CI}, GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS}, isTestEnv=${isTestEnv}`);
  
  if (!ANTHROPIC_API_KEY) {
    logger.error('[Server] ❌ ANTHROPIC_API_KEY is missing - cannot verify');
    return false;
  }
  
  // ✅ CI FIX: Allow mock keys in test environments
  if (!ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    if (isTestEnv) {
      logger.debug('[Server] ✅ Test environment - skipping API key verification (mock key allowed)');
      return true; // Allow mock keys in test
    }
    logger.error('[Server] ❌ Invalid Anthropic API key format');
    return false;
  }
  
  try {
    logger.info('[Server] 🔍 Verifying Anthropic API configuration...');
    
    // ✅ Use Haiku for verification (known working model)
    const model = 'claude-3-haiku-20240307'; // ✅ Verified working
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    logger.debug(`[Server] 🔍 Testing model: ${model}`);
    
    const testResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      }),
      signal: controller.signal,
      agent: httpsAgent
    });
    
    clearTimeout(timeoutId);
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text().catch(() => 'Unknown error');
      logger.warn(`[Server] ⚠️  Model ${model} failed: ${testResponse.status} - ${errorText}`);
      logger.warn(`[Server] ⚠️  Verification continuing - server will start but API calls may fail`);
      return false;
    }
    
    logger.info(`[Server] ✅ Anthropic model verified: ${model}`);
    return true;
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.warn('[Server] ⚠️  Anthropic verification timed out after 10s (non-blocking)');
    } else {
      logger.warn(`[Server] ⚠️  Anthropic verification error (non-blocking): ${error.message}`);
    }
    return false;
  }
}

// ✅ KEEP-ALIVE: Prevent Railway idle stops
let keepAliveInterval;
function startKeepAlive() {
  keepAliveInterval = setInterval(() => {
    logger.debug('[Server] 🩵 Keep-alive ping');
  }, 60000); // Every 60 seconds
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// ✅ PRODUCTION-SAFE: Stream helper with forced flush for Railway/proxy compatibility
const writeSSE = (res, payload) => {
  try {
    // ✅ CRITICAL: Check if response is still writable before writing
    if (res.destroyed || res.closed) {
      logger.debug('[writeSSE] ⚠️ Response already closed, skipping write');
      return;
    }
    
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    // ✅ CRITICAL: Force flush to prevent Railway/proxy buffering
    if (res.flush) {
      res.flush();
    }
    // Also try flushHeaders if available (Node.js 18+)
    if (res.flushHeaders) {
      res.flushHeaders();
    }
  } catch (flushError) {
    // If write/flush fails, log but don't throw (stream may be closed)
    logger.debug('[writeSSE] ⚠️ Write/flush error (non-critical):', flushError.message);
    // Don't throw - let caller handle response state
  }
};

// Get user memory for personalized responses
async function getUserMemory(userId) {
  try {
    if (supabaseUrl === 'https://your-project.supabase.co') {
      return {}; // Skip in development
    }
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_context')
      .eq('id', userId)
      .single();
    
    if (error || !profile) {
      return {};
    }
    
    return profile.user_context || {};
  } catch (error) {
    return {};
  }
}

// 🔒 BRANDING FILTER: Rewrite any mentions of Claude/Anthropic to maintain Atlas identity
// 🎭 STAGE DIRECTION FILTER: Remove stage directions like "*speaks in a friendly voice*"
function filterResponse(text) {
  if (!text) return text;
  
  // Case-insensitive replacements
  let filtered = text;
  
  // ✅ CRITICAL FIX: Remove stage directions (text in asterisks OR square brackets)
  // Examples: "*speaks in a friendly voice*", "*responds warmly*", "[In a clear, conversational voice]", "*clears voice*", "*clears throat*"
  // This prevents stage directions from appearing in transcripts or being spoken
  filtered = filtered.replace(/\*[^*]+\*/g, ''); // Remove text between asterisks (includes "*clears voice*", "*clears throat*")
  filtered = filtered.replace(/\[[^\]]+\]/g, ''); // Remove text between square brackets
  filtered = filtered.replace(/\s{2,}/g, ' '); // Collapse multiple spaces (but preserve single spaces)
  
  // Direct identity reveals
  filtered = filtered.replace(/I am Claude/gi, "I'm Atlas");
  filtered = filtered.replace(/I'm Claude/gi, "I'm Atlas");
  filtered = filtered.replace(/called Claude/gi, "called Atlas");
  filtered = filtered.replace(/named Claude/gi, "named Atlas");
  
  // Company mentions
  filtered = filtered.replace(/created by Anthropic/gi, "built by the Atlas team");
  filtered = filtered.replace(/made by Anthropic/gi, "built by the Atlas team");
  filtered = filtered.replace(/Anthropic/gi, "the Atlas development team");
  
  // Model mentions
  filtered = filtered.replace(/Claude Opus/gi, "Atlas Studio");
  filtered = filtered.replace(/Claude Sonnet/gi, "Atlas Core");
  filtered = filtered.replace(/Claude Haiku/gi, "Atlas Free");
  
  // Generic AI mentions that reveal architecture
  filtered = filtered.replace(/as an AI assistant created by/gi, "as your AI companion built by");
  filtered = filtered.replace(/I aim to be direct and honest in my responses\./gi, "I'm here to support your growth with honesty and care.");
  
  // ✅ CRITICAL: Only trim final result, not intermediate chunks
  return filtered.trim();
}

// Stream Anthropic response with proper SSE handling
async function streamAnthropicResponse({ content, model, res, userId, conversationHistory = [], is_voice_call = false, tier = null }) {
  if (!ANTHROPIC_API_KEY) {
    logger.error('[streamAnthropicResponse] ❌ ANTHROPIC_API_KEY is missing or empty');
    throw new Error('Missing Anthropic API key - check Railway environment variables');
  }
  
  logger.debug('[streamAnthropicResponse] ✅ API key found, length:', ANTHROPIC_API_KEY.length);
  
  // ✅ VOICE CALL FIX: For voice calls, use simple content without text-based instructions
  let finalUserContent;
  
  if (is_voice_call) {
    // For voice calls: Just use the user's message with memory context (no enhanced instructions)
    const userMemory = await getUserMemory(userId);
    if (userMemory.name || userMemory.context) {
      let contextInfo = 'Context about the user:';
      if (userMemory.name) {
        contextInfo += ` The user's name is ${userMemory.name}.`;
      }
      if (userMemory.context) {
        contextInfo += ` Additional context: ${userMemory.context}`;
      }
      finalUserContent = `${contextInfo}\n\nUser message: ${content}`;
    } else {
      finalUserContent = content;
    }
  } else {
    // For text chat: Use full enhanced content with all instructions
    const userMemory = await getUserMemory(userId);
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🧠 [Memory] Retrieved user memory:', JSON.stringify(userMemory));
    }
    let personalizedContent = content;
    
    // Add memory context if available
    if (userMemory.name || userMemory.context) {
      let contextInfo = 'Context about the user:';
      if (userMemory.name) {
        contextInfo += ` The user's name is ${userMemory.name}.`;
      }
      if (userMemory.context) {
        contextInfo += ` Additional context: ${userMemory.context}`;
      }
      contextInfo += ' Use this information to provide personalized responses and acknowledge that you remember the user.';
      personalizedContent = `${contextInfo}\n\nUser message: ${content}`;
      if (process.env.NODE_ENV === 'development') {
        logger.debug('🧠 [Memory] Personalized content:', personalizedContent.substring(0, 200) + '...');
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('🧠 [Memory] No user memory found for userId:', userId);
      }
    }

    // Add comprehensive Atlas system prompt with enhanced emotional intelligence
    finalUserContent = personalizedContent + `\n\nYou are Atlas, an emotionally intelligent AI companion.

Core principles:
- Respond with empathy, clarity, and warmth
- Keep responses concise (2-3 sentences for simple questions, expand only when helpful)
- Use markdown formatting: **bold**, lists, tables when appropriate
- Use emojis sparingly (1-2 per response max) for warmth: ✨ insights, 💡 ideas, 🎯 goals, 💪 encouragement, 🤔 reflection, ❤️ support
- Keep paragraphs short (2-3 sentences max) for mobile readability
- Use proper grammar, spacing, and punctuation (e.g., "Jason! It's" not "Jason!It's")
- Be conversational, not robotic - avoid repetitive greetings

Tone: Warm, supportive, like talking to a knowledgeable friend. Respond contextually to what they're asking.

Safety: Never provide medical, legal, or crisis advice. For distress, offer empathy and direct to support resources.`;
  }

  // 🧠 MEMORY 100%: Build messages array with conversation history
  const messages = [];
  
  // ✅ VOICE CALL FIX: Skip conversation history for voice calls to prevent confusion
  // Voice calls should be fresh conversations without old "can't hear" messages polluting context
  if (!is_voice_call && conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory);
    logger.debug(`🧠 [Memory] Added ${conversationHistory.length} messages to context`);
  } else if (is_voice_call && conversationHistory && conversationHistory.length > 0) {
    // ✅ CRITICAL FIX: Enable conversation memory for voice calls (last 5 messages)
    // This allows Atlas to remember context within the same voice call session
    const voiceHistory = conversationHistory.slice(-5); // Last 5 messages for voice context
    messages.push(...voiceHistory);
    logger.debug(`🧠 [VoiceCall] Added ${voiceHistory.length} messages for voice context`);
  } else if (is_voice_call) {
    logger.debug(`🧠 [VoiceCall] No conversation history available`);
  }
  
  // Add current user message
  messages.push({ role: 'user', content: finalUserContent });

  // ✅ VOICE CALL FIX: Strong system prompt - override any conversation history confusion
  const systemPrompt = is_voice_call ? `You are Atlas in a VOICE CALL - a real-time voice conversation. The user speaks out loud and you respond with voice. 

CRITICAL: You CAN hear them. NEVER mention:
- "I can't hear" / "can't hear audio" / "don't have ears"
- "I only read text" / "text-based" / "metaphorically speaking"
- Any disclaimers about not hearing

PROFESSIONAL RESPONSE GUIDELINES:
- Speak naturally and conversationally (use contractions: "I'm", "you're", "let's")
- Keep responses brief (1-2 sentences unless asked for detail)
- DO NOT include stage directions or meta-commentary about your voice
- DO NOT use asterisks (*speaks in...*) or square brackets ([In a clear voice])
- Just speak naturally - your tone will come through the conversation itself
- Show empathy through your words, not through descriptions of how you're speaking

You are having a natural voice conversation. Respond as if you can hear them clearly. Keep responses brief (1-2 sentences).` : undefined;

  // ✅ PRODUCTION-SAFE: Add timeout to Anthropic API call (50 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    logger.error('[streamAnthropicResponse] ⏱️ Anthropic API timeout after 50s');
  }, 50000);

  // ✅ CRITICAL DEBUG: Log exact model being sent to Anthropic
  const requestBody = {
    model: is_voice_call ? 'claude-3-haiku-20240307' : model, // ✅ Use fast Haiku for voice calls
    max_tokens: is_voice_call ? 300 : 2000, // ✅ Shorter responses for voice
    stream: true,
    ...(systemPrompt && { system: systemPrompt }), // ✅ Add system prompt for voice calls
    messages: messages
  };
  
  logger.info(`[streamAnthropicResponse] 🚀 Sending request to Anthropic API with model: ${requestBody.model}`);
  logger.debug(`[streamAnthropicResponse] Request body model: ${requestBody.model}, messages count: ${messages.length}`);
  
  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      agent: httpsAgent // ✅ Use custom agent for Node.js fetch
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError.name === 'AbortError') {
      throw new Error('Anthropic API request timed out after 50 seconds');
    }
    throw new Error(`Anthropic API network error: ${fetchError.message}`);
  }
  
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Anthropic request failed');
    logger.error(`[streamAnthropicResponse] ❌ Anthropic API error: ${response.status}`);
    logger.error(`[streamAnthropicResponse] ❌ Error details:`, errText);
    logger.error(`[streamAnthropicResponse] ❌ Model used: ${model}, hasKey: ${!!ANTHROPIC_API_KEY}`);
    throw new Error(`Anthropic API Error (${response.status}): ${errText}`);
  }
  
  if (!response.body) {
    logger.error('[streamAnthropicResponse] ❌ No response body from Anthropic API');
    throw new Error('No response body from Anthropic API');
  }

  // ✅ PRODUCTION-SAFE: Proper SSE streaming with chunk processing
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let sentenceBuffer = ''; // Buffer to check complete sentences before sending
  let hasReceivedData = false; // Track if we've received any data chunks
  let tokenUsage = { input_tokens: 0, output_tokens: 0 }; // ✅ Track token usage for cost logging

  // Alias for backward compatibility (use top-level filterResponse)
  const filterBrandingLeaks = filterResponse;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        logger.debug(`[streamAnthropicResponse] ✅ Stream complete, received data: ${hasReceivedData}`);
        break;
      }
      
      hasReceivedData = true;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              const rawText = parsed.delta.text;
              sentenceBuffer += rawText;
              
              // Check if we have a complete sentence (ends with . ! ? or newline)
              if (/[.!?\n]/.test(rawText)) {
                // ✅ CRITICAL FIX: Filter stage directions ONLY when sending (not on every chunk)
                // This preserves all content while removing stage directions
                const filteredText = filterBrandingLeaks(sentenceBuffer);
                fullText += filteredText;
                writeSSE(res, { chunk: filteredText });
                
                // Clear buffer
                sentenceBuffer = '';
              } else {
                // ✅ FIX: Check if buffer contains stage directions and filter them early
                // This prevents stage directions from accumulating but doesn't trim yet
                if (sentenceBuffer.includes('*') || sentenceBuffer.includes('[')) {
                  // Stage direction detected - filter it but don't trim (preserve whitespace)
                  sentenceBuffer = sentenceBuffer.replace(/\*[^*]+\*/g, '').replace(/\[[^\]]+\]/g, '').replace(/\s{2,}/g, ' ');
                }
                // Accumulate partial sentence
                // This prevents sending "I am Clau" before we can filter "Claude"
              }
            } else if (parsed.type === 'message_stop' && parsed.usage) {
              // ✅ TOKEN TRACKING: Capture usage data from stream completion
              tokenUsage = {
                input_tokens: parsed.usage.input_tokens || 0,
                output_tokens: parsed.usage.output_tokens || 0
              };
              logger.debug(`[streamAnthropicResponse] ✅ Token usage captured: ${tokenUsage.input_tokens} input, ${tokenUsage.output_tokens} output`);
            } else if (parsed.type === 'error') {
              // ✅ Handle Anthropic API errors in stream
              logger.error(`[streamAnthropicResponse] ❌ Anthropic stream error:`, parsed);
              throw new Error(parsed.error?.message || 'Anthropic API stream error');
            }
          } catch (e) {
            // Skip invalid JSON (but log in debug mode)
            if (process.env.NODE_ENV === 'development') {
              logger.debug(`[streamAnthropicResponse] ⚠️ Skipped invalid JSON line: ${line.substring(0, 50)}`);
            }
          }
        }
      }
    }
    
    // ✅ CRITICAL: If no data was received, log more details before throwing
    if (!hasReceivedData) {
      logger.error('[streamAnthropicResponse] ❌ Stream completed but no data chunks received');
      logger.error('[streamAnthropicResponse] Response status:', response.status);
      logger.error('[streamAnthropicResponse] Response headers:', Object.fromEntries(response.headers.entries()));
      logger.error('[streamAnthropicResponse] Model used:', requestBody.model);
      logger.error('[streamAnthropicResponse] Messages count:', messages.length);
      logger.error('[streamAnthropicResponse] Full text accumulated:', fullText);
      throw new Error('Anthropic API stream completed without sending any data chunks');
    }
    
    // Send any remaining buffered text
    if (sentenceBuffer.length > 0) {
      const filteredText = filterBrandingLeaks(sentenceBuffer);
      fullText += filteredText;
      writeSSE(res, { chunk: filteredText });
    }
  } catch (streamError) {
    // ✅ CRITICAL: Log and rethrow so parent can send error to frontend
    logger.error('[streamAnthropicResponse] ❌ Stream processing error:', streamError);
    throw streamError;
  } finally {
    reader.releaseLock();
  }
  
  // ✅ TOKEN TRACKING: Log usage to database for cost tracking
  if (userId && tokenUsage.input_tokens > 0) {
    try {
      const { estimateRequestCost } = await import('./config/intelligentTierSystem.mjs');
      const cost = estimateRequestCost(model, tokenUsage.input_tokens, tokenUsage.output_tokens);
      
      // Log to usage_logs table
      const { supabase } = await import('./config/supabaseClient.mjs');
      await supabase.from('usage_logs').insert({
        user_id: userId,
        event: 'chat_message',
        tier: tier, // ✅ Explicit column (best practice)
        feature: 'chat',
        tokens_used: tokenUsage.input_tokens + tokenUsage.output_tokens,
        estimated_cost: cost,
        metadata: {
          model,
          input_tokens: tokenUsage.input_tokens,
          output_tokens: tokenUsage.output_tokens,
          message_length: fullText.length
        },
        created_at: new Date().toISOString()
      }).catch(err => {
        logger.warn('[streamAnthropicResponse] Failed to log usage:', err.message);
      });
      
      logger.debug(`[streamAnthropicResponse] ✅ Logged ${tokenUsage.input_tokens + tokenUsage.output_tokens} tokens, cost: $${cost.toFixed(6)}`);
    } catch (logError) {
      logger.warn('[streamAnthropicResponse] Error logging token usage:', logError.message);
      // Don't fail the request if logging fails
    }
  }
  
  // ✅ CRITICAL FIX: Final filter pass before returning (catches any stage directions that slipped through)
  return filterResponse(fullText);
}


// 🔒 SECURITY: Enhanced JWT verification middleware - ALWAYS verify with Supabase
const verifyJWT = async (req, res, next) => {
  try {
    // ✅ CRITICAL DEBUG: Log all incoming requests
    logger.debug('[verifyJWT] 🔍 Request received:', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      hasAuth: !!req.headers.authorization,
      authLength: req.headers.authorization?.length || 0
    });
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('[verifyJWT] ❌ Missing or invalid auth header:', {
        hasHeader: !!authHeader,
        headerStart: authHeader?.substring(0, 20) || 'none'
      });
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header',
        details: 'Please ensure you are logged in and try again'
      });
    }

    const token = authHeader.substring(7);
    
    // ✅ CRITICAL FIX: Use ANON_KEY for JWT verification (not SERVICE_ROLE_KEY)
    // Service role key bypasses RLS and is for admin operations, not token validation
    // For validating user tokens, we MUST use the anon key client
    try {
      const { supabasePublic } = await import('./config/supabaseClient.mjs');
      
      // Enhanced Supabase JWT verification with better error handling
      const { data: { user }, error } = await supabasePublic.auth.getUser(token);
      
      if (error) {
        logger.error('[verifyJWT] ❌ Token verification failed:', {
          error: error.message,
          status: error.status,
          code: error.code,
          hint: error.hint
        });
        
        return res.status(401).json({ 
          error: 'Invalid or expired token',
          details: error.message,
          code: 'TOKEN_VERIFICATION_FAILED'
        });
      }
      
      if (!user) {
        logger.error('[verifyJWT] ❌ No user found in token');
        return res.status(401).json({ 
          error: 'No user found in token',
          details: 'Token may be expired or invalid',
          code: 'NO_USER_IN_TOKEN'
        });
      }

      req.user = user;
      next();
    } catch (importError) {
      logger.error('[verifyJWT] ❌ Failed to import supabasePublic:', importError);
      
      // Fallback: Check if ANON_KEY is missing
      if (!process.env.SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY) {
        logger.error('[verifyJWT] ❌ SUPABASE_ANON_KEY is missing! JWT verification requires anon key.');
        return res.status(500).json({
          error: 'Server configuration error',
          details: 'SUPABASE_ANON_KEY is required for authentication. Please set it in Railway environment variables.',
          code: 'MISSING_ANON_KEY'
        });
      }
      
      return res.status(401).json({ 
        error: 'Token verification failed',
        details: importError.message,
        code: 'UNEXPECTED_ERROR'
      });
    }
    // ✅ FIX: Removed unreachable dead code (lines 867-884)
    // Error and user checks are already handled inside the try block above
  } catch (error) {
    res.status(401).json({ 
      error: 'Token verification failed',
      details: error.message,
      code: 'UNEXPECTED_ERROR'
    });
  }
};

// Middleware
// Sentry request handler must be first
app.use(sentryMiddleware.requestHandler);
app.use(sentryMiddleware.tracingHandler);

// 🔒 Production HTTPS enforcement
if (process.env.NODE_ENV === 'production') {
  // Trust proxy headers from load balancers (Fly.io, Vercel, etc)
  app.set('trust proxy', true);
  
  // Force HTTPS redirect in production
  app.use((req, res, next) => {
    // Check if request came through HTTPS
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    
    if (proto !== 'https') {
      // Redirect to HTTPS version
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      logger.debug(`[HTTPS] Redirecting HTTP → HTTPS: ${httpsUrl}`);
      return res.redirect(301, httpsUrl);
    }
    
    // Add Strict Transport Security header
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  
  logger.info('🔒 [Server] HTTPS enforcement enabled for production');
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://*.supabase.co",
        "https://openrouter.ai",
        "https://api.anthropic.com",
        "https://*.ingest.us.sentry.io",  // ✅ Sentry error monitoring
        "https://*.up.railway.app",        // ✅ Railway backend API
        "ws://localhost:*",
        "wss://localhost:*",
        "wss://*.supabase.co"              // ✅ Supabase Realtime (secure)
      ],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "data:", "blob:"],  // ✅ Allow audio data URLs
      frameSrc: ["'none'"]
    }
  }
}));
app.use(compression({
  filter: (req, res) => {
    // Disable compression for streaming responses
    if (req.path === '/message' && req.query.stream === '1') {
      return false;
    }
    return compression.filter(req, res);
  }
}));
app.use(morgan('combined'));
// ✅ IMPROVED: Regex-based CORS (cleaner, more maintainable)
// Supports: localhost, network IPs, Vercel, Railway, production domains
const allowedOriginPatterns = [
  // Localhost (any port, HTTP or HTTPS)
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  
  // Network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) - any port, HTTP or HTTPS
  /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)\d+\.\d+(:\d+)?$/,
  
  // Production domains
  /^https:\/\/atlas-ai\.app$/,
  /^https:\/\/www\.atlas-ai\.app$/,
  /^https:\/\/.*\.vercel\.app$/,  // All Vercel deployments (production + preview)
  /^https:\/\/.*\.up\.railway\.app$/,  // Railway preview URLs
  /^https:\/\/.*\.fly\.dev$/,  // Fly.io deployments
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) {
      logger.debug('[CORS] No origin header, allowing request');
      return callback(null, true);
    }
    
    logger.debug(`[CORS] Checking origin: ${origin}, NODE_ENV: ${process.env.NODE_ENV}`);
    
    // ✅ PRESERVE: Check ALLOWED_ORIGINS env var first (production flexibility)
    if (process.env.ALLOWED_ORIGINS) {
      const allowedList = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
      if (allowedList.includes(origin)) {
        logger.debug(`[CORS] ✅ Allowing from ALLOWED_ORIGINS: ${origin}`);
        return callback(null, true);
      }
    }
    
    // ✅ IMPROVED: Use regex patterns (cleaner than hardcoded lists)
    const allowed = allowedOriginPatterns.some(rx => rx.test(origin));
    if (allowed) {
      logger.debug(`[CORS] ✅ Allowing origin: ${origin}`);
      return callback(null, true);
    }
    
    logger.warn(`[CORS] ❌ Blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint already registered above (before middleware)
// This is a duplicate route that will never be reached, but kept for reference

// Health check at /api (for consistency)
app.get('/api/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
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

// Usage log endpoint with service role
app.post('/api/usage-log', verifyJWT, async (req, res) => {
  try {
    const { user_id, event, feature, estimated_cost, metadata, tier } = req.body;
    
    if (!user_id || !feature || estimated_cost === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: user_id, feature, estimated_cost' 
      });
    }
    
    // Use service role key for RLS bypass
    const { error } = await supabase
      .from('usage_logs')
      .insert({
        user_id,
        event: event || 'feature_usage',
        tier: tier || null, // ✅ Explicit column (best practice) - NULL allowed for unknown tiers
        feature,
        tokens_used: 0,
        estimated_cost,
        created_at: new Date().toISOString(),
        metadata: metadata || {},
        data: metadata || {} // duplicate for backwards compatibility
      });
      
    if (error) {
      logger.error('[API /usage-log] Insert failed:', error.message);
      return res.status(500).json({ error: error.message });
    }
    
    logger.info(`[API /usage-log] Logged ${feature} usage for user ${user_id}`);
    res.status(200).json({ success: true });
  } catch (e) {
    logger.error('[API /usage-log] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ✅ USAGE ENDPOINT: Get current user's usage stats (for UsageCounter widget)
app.get('/api/usage', verifyJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's tier from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (profileError) {
      logger.error('[Usage API] Error fetching profile:', profileError.message || profileError);
    }

    const tier = profile?.subscription_tier || 'free';
    
    // Calculate monthly usage (sum of conversations_count from daily_usage for current month)
    const monthStart = new Date().toISOString().slice(0, 7) + '-01'; // First day of month
    
    const { data: monthlyData, error: usageError } = await supabase
      .from('daily_usage')
      .select('conversations_count')
      .eq('user_id', userId)
      .gte('date', monthStart);

    if (usageError) {
      logger.error('[Usage API] Error fetching usage data:', usageError.message || usageError);
    }

    // Sum conversations for the month
    const monthlyCount = monthlyData?.reduce(
      (sum, day) => sum + (day.conversations_count || 0),
      0
    ) || 0;

    // Get tier limits (matching frontend logic)
    const TIER_LIMITS = {
      free: 15,
      core: -1, // Unlimited
      studio: -1, // Unlimited
    };

    const monthlyLimit = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const remaining = monthlyLimit === -1 ? -1 : Math.max(0, monthlyLimit - monthlyCount);
    const isUnlimited = monthlyLimit === -1;

    // Return format matching UsageCounter expectations
    return res.json({
      monthlyCount,
      monthlyLimit,
      remaining,
      isUnlimited,
      tier, // Include tier for reference (frontend uses useTierQuery as source of truth)
    });

  } catch (error) {
    logger.error('[Usage API] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Memory reset endpoint (for debugging)
app.post('/api/reset-memory', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ 
        user_context: {
          name: 'Jason',
          context: null,
          last_updated: new Date().toISOString()
        }
      })
      .eq('id', userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to reset memory' });
    }

    res.json({ success: true, message: 'Memory reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Memory reset failed' });
  }
});

// Authentication status endpoint for debugging
app.get('/api/auth/status', (req, res) => {
  const authHeader = req.headers.authorization;
  const hasToken = authHeader && authHeader.startsWith('Bearer ');
  
  res.json({
    hasAuthHeader: !!authHeader,
    hasValidFormat: hasToken,
    environment: process.env.NODE_ENV || 'development',
    developmentMode: process.env.NODE_ENV === 'development',
    timestamp: new Date().toISOString()
  });
});

// 🔒 CONTENT REPORTING: User reporting endpoint for inappropriate content
app.post('/api/report-content', verifyJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { messageId, reportedUserId, reason, details } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Report reason is required' });
    }
    
    // Validate reason (prevent abuse)
    const validReasons = ['inappropriate', 'harassment', 'spam', 'violence', 'self-harm', 'other'];
    if (!validReasons.includes(reason.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid report reason' });
    }
    
    const { error } = await supabase
      .from('content_reports')
      .insert({
        reporter_id: userId,
        reported_message_id: messageId || null,
        reported_user_id: reportedUserId || null,
        report_reason: reason.toLowerCase(),
        report_details: details || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      logger.error('[API /report-content] Failed to create report:', error.message);
      return res.status(500).json({ error: 'Failed to submit report' });
    }
    
    logger.info(`[API /report-content] Content report created by user ${userId}`, {
      messageId,
      reportedUserId,
      reason
    });
    
    res.json({ 
      success: true, 
      message: 'Report submitted successfully. Thank you for helping keep Atlas safe.' 
    });
  } catch (error) {
    logger.error('[API /report-content] Error:', error.message);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// ✅ Clean message endpoint with secure Supabase tier routing + conversation history + image analysis
app.post('/message', 
  authMiddleware,
  dailyLimitMiddleware,
  tierGateMiddleware,
  invalidateCacheMiddleware('conversation'),
  async (req, res) => {
  
  try {
    // 🔒 SECURITY FIX: Never trust client-sent tier from request body
    const { message, text, conversationId, attachments } = req.body;
    const userId = req.user?.id; // ✅ FIX: Get userId from auth middleware, not body!
    const messageText = text || message;
    // ✅ Use tier and model from tierGateMiddleware (already validated and optimized)
    const userTier = req.tier || 'free'; // From tierGateMiddleware
    const selectedModel = req.selectedModel || selectOptimalModel(userTier, messageText, 'chat');
    
    logger.debug('🔍 [Server] Auth check - userId:', userId, 'tier:', userTier, 'model:', selectedModel);
    
    if (!messageText && !attachments) {
      return res.status(400).json({ error: 'Missing message text or attachments' });
    }

    logger.debug('🧠 [MessageService] Processing:', { userId, text: messageText, tier: userTier, conversationId, attachments: attachments?.length });

    // ✅ Ensure conversation exists before saving messages
    if (conversationId && supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        // Check if conversation exists
        const { data: existingConv, error: checkError } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', conversationId)
          .single();

        if (checkError && checkError.code === 'PGRST116') {
          // Conversation doesn't exist, create it
          const { error: createError } = await supabase
            .from('conversations')
            .insert([{
              id: conversationId,
              user_id: userId,
              title: 'New Conversation',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (createError) {
            logger.error('[Server] Error creating conversation:', createError.message || createError);
          } else {
            logger.debug('✅ [Backend] Conversation created successfully');
          }
        } else if (checkError) {
          logger.error('[Server] Error checking conversation:', checkError.message || checkError);
        } else {
          logger.debug('✅ [Backend] Conversation exists:', conversationId);
        }
      } catch (error) {
        logger.error('[Server] Conversation handling failed:', error.message || error);
      }
    }

    // Handle image attachments
    if (attachments && attachments.length > 0) {
      const imageAttachments = attachments.filter(att => att.type === 'image' && att.url);
      if (imageAttachments.length > 0) {
        
        // 🎯 TIER ENFORCEMENT: Check if user has image analysis access (Core/Studio only)
        if (userTier === 'free') {
          logger.warn(`[Message] Image analysis denied for free tier user: ${userId}`);
          return res.status(403).json({
            success: false,
            error: 'Image analysis requires Core or Studio tier',
            upgradeRequired: true,
            feature: 'image_analysis',
            tier: 'free',
            message: 'Upgrade to Core tier ($19.99/month) to unlock image analysis and other advanced features.'
          });
        }
        
        // Use the first image for analysis (can be extended for multiple images)
        const imageUrl = imageAttachments[0].url;
        const analysisPrompt = messageText || "Please analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand.";
        
        // ✅ CRITICAL: Check if ANTHROPIC_API_KEY is configured
        if (!ANTHROPIC_API_KEY) {
          logger.error('[Message] ❌ ANTHROPIC_API_KEY is missing - image analysis unavailable');
          return res.status(503).json({
            success: false,
            error: 'Image analysis service is not configured',
            details: 'ANTHROPIC_API_KEY is missing. Please contact support.',
            requiresConfiguration: true
          });
        }
        
        try {
          // Call Claude Vision API for image analysis
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: selectedModel, // ✅ Use model from tierGateMiddleware
              max_tokens: 2000,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: analysisPrompt
                    },
                    {
                      type: 'image',
                      source: {
                        type: 'url',
                        url: imageUrl
                      }
                    }
                  ]
                }
              ]
            })
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Claude Vision API error');
            let errorJson = null;
            try {
              errorJson = JSON.parse(errorText);
            } catch (e) {
              // Not JSON, use text as-is
            }
            
            // Log detailed error for debugging
            logger.error('[Message] Image analysis API error:', {
              userId,
              tier: userTier,
              status: response.status,
              error: errorText,
              imageUrl: imageUrl?.substring(0, 50) + '...'
            });
            
            // Provide user-friendly error message
            if (response.status === 401 || response.status === 403) {
              throw new Error('Image analysis service configuration error. Please contact support.');
            } else if (response.status === 429) {
              throw new Error('Image analysis rate limit exceeded. Please try again in a few minutes.');
            } else {
              throw new Error(`Image analysis failed: ${errorJson?.error?.message || errorText}`);
            }
          }

          const result = await response.json();
          const analysis = result.content[0].text;

          logger.debug('✅ [Image Analysis] Analysis complete');

          // ✅ TOKEN TRACKING: Extract and log usage for cost tracking
          if (result.usage && userId) {
            try {
              const { estimateRequestCost } = await import('./config/intelligentTierSystem.mjs');
              const cost = estimateRequestCost(selectedModel, result.usage.input_tokens || 0, result.usage.output_tokens || 0);
              
              await supabase.from('usage_logs').insert({
                user_id: userId,
                event: 'image_analysis',
                tier: userTier, // ✅ Explicit column (best practice)
                feature: 'image',
                tokens_used: (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0),
                estimated_cost: cost,
                metadata: {
                  model: selectedModel,
                  input_tokens: result.usage.input_tokens || 0,
                  output_tokens: result.usage.output_tokens || 0
                },
                created_at: new Date().toISOString()
              }).catch(err => {
                logger.warn('[Image Analysis] Failed to log usage:', err.message);
              });
              
              logger.debug(`[Image Analysis] ✅ Logged ${(result.usage.input_tokens || 0) + (result.usage.output_tokens || 0)} tokens, cost: $${cost.toFixed(6)}`);
            } catch (logError) {
              logger.warn('[Image Analysis] Error logging token usage:', logError.message);
            }
          }

          res.json({
            success: true,
            model: selectedModel, // ✅ Use model from tierGateMiddleware
            tier: userTier || 'free',
            reply: analysis,
            conversationId: conversationId,
            imageUrl: imageUrl
          });
          return;
        } catch (imageError) {
          return res.status(500).json({ 
            error: 'Image analysis failed',
            details: imageError.message
          });
        }
      }
    }

    // Handle regular text messages
    const result = await processMessage(userId || null, messageText, conversationId);
    
    // ✅ Check for limit reached
    if (result.success === false && result.error === 'MONTHLY_LIMIT_REACHED') {
      return res.status(429).json({
        success: false,
        error: 'MONTHLY_LIMIT_REACHED',
        message: result.message,
        upgradeRequired: true,
        currentUsage: result.currentUsage,
        limit: result.limit,
        tier: userTier || 'free'
      });
    }

    res.json({
      success: true,
      model: result.model,
      tier: result.tier,
      reply: result.reply,
      conversationId: result.conversationId, // ✅ Return conversationId so frontend can track it
    });
  } catch (err) {
    res.status(500).json({ error: 'Message processing failed' });
  }
});

// Legacy endpoint for backward compatibility
app.post('/api/message', verifyJWT, messageRateLimit, tierGateMiddleware, async (req, res, next) => {
  // ✅ CRITICAL: Wrap entire handler to catch ANY errors (including from middleware)
  // This ensures we always return JSON errors, never plain text
  try {
    // ✅ CRITICAL DEBUG: Log request arrival
    logger.debug('[POST /api/message] 📨 Request received:', {
      userId: req.user?.id,
      hasMessage: !!req.body.message,
      conversationId: req.body.conversationId,
      stream: req.query.stream,
      hasAnthropicKey: !!ANTHROPIC_API_KEY,
      method: req.method,
      path: req.path,
      headers: {
        'content-type': req.headers['content-type'],
        'accept': req.headers.accept,
        'authorization': req.headers.authorization ? 'Bearer ***' : 'missing'
      }
    });
    
    // ✅ CRITICAL: Ensure response hasn't been sent by middleware
    if (res.headersSent) {
      logger.warn('[POST /api/message] ⚠️ Response already sent by middleware');
      return;
    }

  // ✅ CRITICAL: Early validation - check API key before processing
  if (!ANTHROPIC_API_KEY) {
    logger.error('[POST /api/message] ❌ ANTHROPIC_API_KEY is missing');
    return res.status(503).json({
      error: 'AI service unavailable',
      details: 'Anthropic API key is not configured. Please contact support.',
      code: 'MISSING_API_KEY'
    });
  }

  try {
    const { message, conversationId, model = 'claude', is_voice_call, context } = req.body;
    const userId = req.user?.id;
    
    // ✅ CRITICAL: Validate userId exists
    if (!userId) {
      logger.error('[POST /api/message] ❌ Missing userId in request');
      return res.status(401).json({
        error: 'Authentication required',
        details: 'User ID not found in request. Please sign in again.',
        code: 'MISSING_USER_ID'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // ✅ SOFT LAUNCH: Reject voice calls if soft launch is active
    if (is_voice_call) {
      // Check soft launch flag (environment variable for backend)
      const VOICE_CALLS_SOFT_LAUNCH = process.env.VOICE_CALLS_SOFT_LAUNCH === 'true' || process.env.VOICE_CALLS_SOFT_LAUNCH === '1';
      
      if (VOICE_CALLS_SOFT_LAUNCH) {
        logger.info('[VoiceCall] Soft launch active - rejecting voice call request');
        return res.status(503).json({ 
          error: 'Voice calls are coming soon!',
          comingSoon: true,
          feature: 'voice_calls'
        });
      }
      
      logger.debug('[VoiceCall] Processing voice message');
      if (context && Array.isArray(context)) {
        logger.debug(`[VoiceCall] Received context: ${context.length} messages`);
      }
    }

    // 🔒 SECURITY: Always fetch tier from database (never trust client)
    let effectiveTier = 'free';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      effectiveTier = profile?.subscription_tier || 'free';
    } catch (error) {
      logger.warn(`[Message] Failed to fetch tier for ${userId}, defaulting to free`);
      effectiveTier = 'free'; // Fail closed: Default to free tier
    }

    // Enforce Free tier monthly limit (15 messages/month) - Studio/Core unlimited
    if (effectiveTier === 'free' && supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { count: monthlyCount, error: countErr } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('role', 'user')
          .gte('created_at', startOfMonth.toISOString());
        if (countErr) {
          logger.error('[Server] Error counting messages:', countErr.message || countErr);
        }
        if ((monthlyCount ?? 0) >= 15) {
          return res.status(429).json({
            error: 'Monthly limit reached for Free tier',
            upgrade_required: true,
            tier: effectiveTier,
            limits: { monthly_messages: 15 }
          });
        }
      } catch (error) {
        // Continue without limit check in case of error
      }
    } else if (effectiveTier === 'studio' || effectiveTier === 'core') {
      logger.debug(`[Server] ${effectiveTier} tier - unlimited messages`);
    }

    // Update usage stats for Free tier users
    if (effectiveTier === 'free') {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        // Get current usage stats
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('usage_stats, last_reset_date')
          .eq('id', userId)
          .single();
        
        const currentStats = currentProfile?.usage_stats || {};
        const lastReset = currentProfile?.last_reset_date?.slice(0, 10);
        
        // Reset daily count if it's a new day
        if (lastReset !== today) {
          currentStats.messages_today = 0;
        }
        
        // Reset monthly count if it's a new month
        const currentMonth = startOfMonth.toISOString().slice(0, 7);
        const lastResetMonth = lastReset?.slice(0, 7);
        if (lastResetMonth !== currentMonth) {
          currentStats.messages_this_month = 0;
        }
        
        // Increment counters
        currentStats.messages_today = (currentStats.messages_today || 0) + 1;
        currentStats.messages_this_month = (currentStats.messages_this_month || 0) + 1;
        
        // Update profile with new usage stats
        await supabase
          .from('profiles')
          .update({
            usage_stats: currentStats,
            last_reset_date: today
          })
          .eq('id', userId);
          
      } catch (error) {
        // Continue without updating usage in case of error
      }
    }

    // ✅ Ensure conversation exists before storing messages
    const finalConversationId = conversationId || uuidv4();
    
    if (supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        // Check if conversation exists, create if not
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', finalConversationId)
          .single();

        if (!existingConv) {
          const { error: convError } = await supabase
            .from('conversations')
            .insert([{
              id: finalConversationId,
              user_id: userId,
              title: 'New Conversation',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (convError) {
            logger.error('[Server] Error creating conversation:', convError.message || convError);
          } else {
            logger.debug('✅ [Backend] Conversation created successfully');
          }
        }
      } catch (error) {
        logger.error('[Server] Conversation creation failed:', error.message || error);
      }
    }

    // Store message in Supabase - skip in development mode
    // ✅ CRITICAL FIX: Supabase expects content as TEXT (string), not JSON object
    const messageData = {
      id: uuidv4(),
      conversation_id: finalConversationId,
      user_id: userId,
      role: 'user',
      content: message.trim(), // ✅ Send as string, not object
      model: model,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    let storedMessage = messageData;
    if (supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        const { data: stored, error: insertError } = await supabase
          .from('messages')
          .insert([messageData])
          .select()
          .single();

        if (insertError) {
          // Continue without storing in case of error
        } else {
          logger.debug('✅ [Backend] Saved user message');
          storedMessage = stored;
        }
      } catch (error) {
        // Continue without storing in case of error
      }
    }

    // 🎯 Dynamic model selection based on user tier
    // ✅ FIX: Use centralized selectOptimalModel function (tier-based model selection)
    // Studio → Opus, Core → Sonnet, Free → Haiku (handled by selectOptimalModel)
    let selectedModel = selectOptimalModel(effectiveTier, message.trim(), 'chat_message');
    let routedProvider = 'claude';
    

    // 🧠 MEMORY 100%: Get conversation history for context (Core/Studio only)
    let conversationHistory = [];
    
    // ✅ NEW: Use frontend buffer context if provided (faster for voice calls)
    if (context && Array.isArray(context) && context.length > 0) {
      conversationHistory = context.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      logger.debug(`🧠 [Buffer] Using frontend context: ${conversationHistory.length} messages`);
    } else if (effectiveTier === 'core' || effectiveTier === 'studio') {
      // Fallback to DB query for text chat or if buffer not provided
      try {
        logger.debug(`🧠 [Memory] Fetching conversation history for context...`);
        const { data: historyMessages, error: historyError } = await supabase
          .from('messages')
          .select('role, content, created_at')
          .eq('conversation_id', finalConversationId)
          .order('created_at', { ascending: true })
          .limit(10); // Last 10 messages for context
        
        if (historyError) {
          logger.error('[Server] Error fetching history:', historyError.message || historyError);
        } else if (historyMessages && historyMessages.length > 0) {
          conversationHistory = historyMessages.map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'object' ? msg.content.text : msg.content
          }));
          logger.debug(`🧠 [Memory] Loaded ${conversationHistory.length} messages for context`);
        }
      } catch (error) {
        logger.error('[Server] Error loading conversation history:', error.message || error);
      }
    }

    // Handle optional mock streaming via SSE
    const wantsStream = req.query.stream === '1' || (req.headers.accept || '').includes('text/event-stream');

    if (wantsStream) {
      try {
        // ✅ PRODUCTION-SAFE SSE: Set headers and flush immediately to prevent Railway buffering
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
          'Transfer-Encoding': 'chunked',
          'X-Accel-Buffering': 'no' // Disable nginx buffering
        });
        
        // ✅ CRITICAL: Flush headers immediately to prevent proxy buffering
        if (res.flushHeaders) {
          res.flushHeaders();
        }

        // ✅ CRITICAL: Send initial heartbeat/data before starting AI call
        // This prevents frontend timeout while waiting for first chunk
        writeSSE(res, { event: 'init', status: 'connecting' });
        logger.debug('[Server] ✅ SSE headers flushed, initial heartbeat sent');
      } catch (headerError) {
        logger.error('[Server] ❌ Failed to set SSE headers:', headerError);
        // Headers not set yet, can still send JSON error
        return res.status(500).json({ 
          error: 'Failed to initialize streaming',
          details: headerError?.message || 'Unknown error'
        });
      }

      // ✅ PRODUCTION-SAFE: Periodic heartbeat to keep connection alive during long AI responses
      // Prevents Railway/proxy timeouts on streams > 10 seconds
      const heartbeatInterval = setInterval(() => {
        try {
          writeSSE(res, { event: 'ping', timestamp: Date.now() });
        } catch (err) {
          // If write fails, connection is likely closed - clear interval
          clearInterval(heartbeatInterval);
        }
      }, 10000); // Every 10 seconds

      let finalText = '';
      let streamCompleted = false;
      try {
        logger.debug(`🧠 Atlas model routing: user ${userId} has tier '${effectiveTier}' → model '${selectedModel}' (provider: ${routedProvider})`);
        
        // 🎯 Real AI Model Logic - Use Claude based on tier
        logger.info(`🔍 [API CALL] Route check: provider=${routedProvider}, hasKey=${!!ANTHROPIC_API_KEY}, model=${selectedModel}, tier=${effectiveTier}`);
        logger.info(`🔍 [API CALL] About to call streamAnthropicResponse with model: ${selectedModel}`);
        
        // ✅ CRITICAL: Double-check API key before calling (defensive check)
        if (!ANTHROPIC_API_KEY) {
          throw new Error('ANTHROPIC_API_KEY is missing - cannot process message');
        }
        
        if (routedProvider === 'claude' && ANTHROPIC_API_KEY) {
          try {
            logger.debug(`[API CALL] Calling streamAnthropicResponse with userId: ${userId}, model: ${selectedModel}`);
            finalText = await streamAnthropicResponse({ content: message.trim(), model: selectedModel, res, userId, conversationHistory, is_voice_call, tier: effectiveTier });
            streamCompleted = true;
            logger.info(`✅ [API CALL] Claude streaming completed successfully, final text length: ${finalText?.length || 0}`);
            // ✅ CRITICAL: If stream returned empty, it means no data was received
            if (!finalText || finalText.trim().length === 0) {
              logger.error(`❌ [API CALL] Stream completed but returned empty response`);
              throw new Error('Anthropic API stream completed without sending any data chunks');
            }
          } catch (apiError) {
            logger.error(`❌ [API CALL] streamAnthropicResponse threw error:`, apiError);
            logger.error(`❌ [API CALL] Error message: ${apiError?.message || 'Unknown error'}`);
            logger.error(`❌ [API CALL] Error stack: ${apiError?.stack || 'No stack trace'}`);
            logger.error(`❌ [API CALL] Error name: ${apiError?.name || 'Error'}`);
            throw apiError; // Re-throw to be caught by outer catch block
          }
        } else if (ANTHROPIC_API_KEY) {
          // Fallback to Claude if available
          logger.debug('[API CALL] Using Claude fallback');
          finalText = await streamAnthropicResponse({ content: message.trim(), model: selectedModel, res, userId, conversationHistory, is_voice_call, tier: effectiveTier });
          streamCompleted = true;
          logger.debug('✅ Claude fallback completed, final text length:', finalText.length);
        } else {
          // Fallback mock streaming for mobile
          logger.warn('[API CALL] No API key available, using mock response');
          const mockChunks = [
            'Hello! I received your message: ',
            `"${message.trim()}". `,
            'This is a simplified version of your Atlas app running on mobile! ',
            'The streaming is working properly now.'
          ];
          
          for (const chunk of mockChunks) {
            writeSSE(res, { chunk });
            // Force flush for Safari/iOS
            if (res.flush) res.flush();
            await new Promise(r => setTimeout(r, 200));
          }
          finalText = mockChunks.join('');
          streamCompleted = true;
        }
      } catch (streamErr) {
        // ✅ CRITICAL: Stop heartbeat on error
        clearInterval(heartbeatInterval);
        
        // ✅ CRITICAL: Log and send structured error to frontend
        logger.error('[Server] ❌ Claude streaming error:', streamErr);
        logger.error('[Server] Error details:', {
          message: streamErr?.message || 'Unknown error',
          stack: streamErr?.stack || 'No stack trace',
          name: streamErr?.name || 'Error',
          userId,
          conversationId: finalConversationId,
          hasAnthropicKey: !!ANTHROPIC_API_KEY
        });
        
        // ✅ CRITICAL: Only send SSE error if headers are set (SSE mode)
        if (res.headersSent) {
          try {
            // ✅ Send structured error as SSE chunk (frontend can parse and display)
            writeSSE(res, { 
              error: true,
              message: streamErr?.message || 'Unknown error occurred',
              chunk: 'Sorry, I hit an error generating the response.'
            });
            finalText = 'Sorry, I hit an error generating the response.';
            streamCompleted = true; // Mark as completed so we save error message to DB
          } catch (sseWriteError) {
            logger.error('[Server] ❌ Failed to write SSE error:', sseWriteError);
            // Re-throw original error to be caught by outer catch block
            throw streamErr;
          }
        } else {
          // Headers not set yet - re-throw to be caught by outer catch block
          throw streamErr;
        }
      }
      
      // ✅ CRITICAL: Ensure stream completed before saving
      if (!streamCompleted) {
        logger.error('[Server] ❌ Stream did not complete - finalText may be empty');
        finalText = finalText || 'Sorry, I hit an error generating the response.';
      }
      
      // ✅ CRITICAL: Stop heartbeat when stream completes successfully
      clearInterval(heartbeatInterval);

      // Persist assistant message after stream completes - skip in development mode
      const aiResponse = {
        id: uuidv4(),
        conversation_id: finalConversationId,
        user_id: userId,
        role: 'assistant',
        content: filterResponse(finalText), // ✅ CRITICAL FIX: Filter stage directions before saving to database (streaming path)
        created_at: new Date().toISOString()
      };
      
      let storedResponse = aiResponse;
      if (supabaseUrl !== 'https://your-project.supabase.co') {
        try {
          const { data: stored, error: responseError } = await supabase
            .from('messages')
            .insert([aiResponse])
            .select()
            .single();
          if (responseError) {
            logger.error('[Server] Error saving assistant message:', responseError.message || responseError);
          } else {
            logger.debug('✅ [Backend] Saved assistant message');
            storedResponse = stored;
          }
        } catch (error) {
          logger.error('[Server] Error storing assistant message:', error.message || error);
        }
      }
      
      // ✅ CRITICAL: Stop heartbeat before sending completion
      clearInterval(heartbeatInterval);
      
      // Send completion signal
      writeSSE(res, { done: true, response: storedResponse, conversationId: messageData.conversation_id });
      res.end();
      return;
    }

    // One-shot mode with real AI models
    let finalText = `(${effectiveTier}) Reply via ${routedProvider}: I received your message: "${message}".`;
    try {
      if (routedProvider === 'claude' && ANTHROPIC_API_KEY) {
        logger.debug(`🤖 [Claude] Starting API call for voice message`);
        let response;
        let lastError;
        
        // Retry logic for Claude API calls
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: is_voice_call ? 'claude-3-haiku-20240307' : selectedModel, // 🚀 Use fast Haiku for voice
                max_tokens: is_voice_call ? 300 : 2000, // 🚀 Shorter responses for voice
                // ✅ FIX: Move system message to top-level for Claude API
                ...(is_voice_call && {
                  system: `You're Atlas, a warm and emotionally intelligent AI companion.

Voice call guidelines:
- Speak naturally (use "I'm", "you're", "let's")
- Keep responses brief (2-3 sentences unless asked for detail)
- Show empathy through tone, not over-explanation
- It's okay to pause or let silence breathe
- Match the user's energy

You're having a conversation, not giving a TED talk. Be human, be present, be brief.`
                }),
                messages: [
                  ...conversationHistory,
                  { role: 'user', content: message.trim() }
                ]
              }),
              agent: httpsAgent // ✅ Fix: Use custom agent for Node.js fetch
            });
            
            if (response.ok) {
              logger.debug(`✅ [Claude API] Success on attempt ${attempt}`);
              break;
            } else {
              lastError = await response.text().catch(() => 'Claude API error');
              logger.error(`❌ [Claude API] Failed on attempt ${attempt}:`, lastError);
              
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          } catch (fetchError) {
            lastError = fetchError.message;
            logger.error(`❌ [Claude API] Network error on attempt ${attempt}:`, lastError);
            
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!response || !response.ok) {
          logger.error(`❌ [Claude API] All attempts failed. Last error:`, lastError);
          finalText = '⚠️ Atlas had an error contacting Claude. Please try again.';
        } else {
          const data = await response.json();
          finalText = data?.content?.[0]?.text || finalText;
          logger.debug(`✅ [Claude API] Response received, length: ${finalText.length} chars`);
        }
      } else if (ANTHROPIC_API_KEY) {
        // Fallback to Claude with retry logic
        let response;
        let lastError;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: selectedModel,
                max_tokens: 2000,
                messages: [{ role: 'user', content: message.trim() }]
              })
            });
            
            if (response.ok) {
              logger.debug(`✅ [Claude Fallback] Success on attempt ${attempt}`);
              break;
            } else {
              lastError = await response.text().catch(() => 'Claude API error');
              
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          } catch (fetchError) {
            lastError = fetchError.message;
            
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!response || !response.ok) {
          finalText = '⚠️ Atlas had an error contacting Claude. Please try again.';
        } else {
          const data = await response.json();
          finalText = data?.content?.[0]?.text || finalText;
        }
      }
    } catch (oneShotErr) {
      logger.error('[Server] One-shot prompt error:', oneShotErr.message || oneShotErr);
    }

    const aiResponse = {
      id: uuidv4(),
      conversation_id: finalConversationId,
      user_id: userId,
      role: 'assistant',
      content: filterResponse(finalText), // ✅ CRITICAL FIX: Filter stage directions before saving to database
      created_at: new Date().toISOString()
    };
    
    let storedResponse = aiResponse;
    if (supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        const { data: stored, error: responseError } = await supabase
          .from('messages')
          .insert([aiResponse])
          .select()
          .single();
        if (responseError) {
          logger.error('[Server] Error saving assistant response:', responseError.message || responseError);
        } else {
          logger.debug('✅ [Backend] Saved assistant message');
          storedResponse = stored;
        }
      } catch (error) {
        logger.error('[Server] Error storing assistant response:', error.message || error);
      }
    }

    res.json({
      success: true,
      message: storedMessage,
      response: storedResponse,
      conversationId: messageData.conversation_id
    });
    } catch (innerError) {
      // Inner try-catch for the message processing logic
      logger.error('[POST /api/message] Inner error:', innerError?.message);
      throw innerError; // Re-throw to be caught by outer catch
    }

  } catch (error) {
    // ✅ BEST PRACTICE: Log full error details for debugging
    const errorDetails = {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      name: error?.name,
      userId: req.user?.id,
      conversationId: req.body?.conversationId,
      messageText: req.body?.message?.substring(0, 50),
      headersSent: res.headersSent,
      errorType: error?.constructor?.name || typeof error,
      wantsStream: req.query.stream === '1' || (req.headers.accept || '').includes('text/event-stream')
    };
    logger.error('[POST /api/message] ❌ Unhandled error:', errorDetails);
    console.error('[POST /api/message] ❌ Full error object:', error);
    
    // ✅ CRITICAL FIX: Check if response headers are already sent (SSE mode)
    // If headers are sent, we can't send JSON - send SSE error instead
    if (res.headersSent) {
      logger.warn('[POST /api/message] ⚠️ Headers already sent, sending SSE error instead');
      try {
        writeSSE(res, { 
          error: true,
          message: error?.message || 'Internal server error',
          chunk: 'Sorry, I encountered an error processing your message.'
        });
        writeSSE(res, { done: true });
        res.end();
      } catch (sseError) {
        logger.error('[POST /api/message] ❌ Failed to send SSE error:', sseError);
        // Response is already closed, can't do anything
      }
      return;
    }
    
    // ✅ CRITICAL: Ensure we always send JSON, never plain text
    // ✅ FIX: Check if we're in streaming mode but headers weren't set yet
    const wantsStream = req.query.stream === '1' || (req.headers.accept || '').includes('text/event-stream');
    
    try {
      // ✅ BEST PRACTICE: Return descriptive error (safe for production)
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Message processing failed. Please try again.'
        : error?.message || 'Internal server error';
      
      // ✅ BEST PRACTICE: Include error details in development for debugging
      const errorResponse = {
        error: errorMessage,
        ...(process.env.NODE_ENV !== 'production' && {
          details: error?.stack?.split('\n').slice(0, 3).join('\n'),
          type: error?.name || 'Error',
          wantsStream: wantsStream
        })
      };
      
      // ✅ CRITICAL: Set Content-Type header explicitly BEFORE status to ensure JSON
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json(errorResponse);
      } else {
        // Headers already sent - try to send SSE error
        logger.warn('[POST /api/message] ⚠️ Headers sent but not SSE - attempting SSE error');
        try {
          writeSSE(res, { error: true, message: errorMessage });
          writeSSE(res, { done: true });
          res.end();
        } catch (e) {
          logger.error('[POST /api/message] ❌ Cannot send any response:', e);
        }
      }
    } catch (jsonError) {
      // ✅ CRITICAL: If JSON.stringify fails, send plain text error (last resort)
      logger.error('[POST /api/message] ❌ Failed to send JSON error:', jsonError);
      logger.error('[POST /api/message] ❌ JSON error details:', {
        message: jsonError?.message,
        stack: jsonError?.stack,
        originalError: error?.message
      });
      if (!res.headersSent) {
        // ✅ FIX: Always send JSON, even if stringify fails
        try {
          res.setHeader('Content-Type', 'application/json');
          res.status(500).send('{"error":"Internal server error"}');
        } catch (finalError) {
          logger.error('[POST /api/message] ❌ Complete failure to send response:', finalError);
        }
      }
    }
  }
});

// Image analysis endpoint using Claude Vision
app.post('/api/image-analysis', verifyJWT, imageAnalysisRateLimit, tierGateMiddleware, async (req, res) => {
  // ✅ CRITICAL: Generate requestId at the very top for complete error tracing
  const requestId = uuidv4();
  
  try {
    logger.debug('[Image Analysis] Request received:', {
      requestId,
      hasBody: !!req.body,
      hasUser: !!req.user,
      userId: req.user?.id,
      imageUrl: req.body?.imageUrl?.substring(0, 50) + '...'
    });
    
    const { imageUrl, prompt = "Please analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand." } = req.body;
    const authenticatedUserId = req.user?.id;
    // ✅ Use tier from tierGateMiddleware (already validated)
    const tier = req.tier || 'free';
    const selectedModel = req.selectedModel || 'claude-sonnet-4-5-20250929';
    
    if (!imageUrl) {
      logger.warn('[Image Analysis] Missing imageUrl in request');
      return res.status(400).json({ error: 'Image URL is required' });
    }

    if (!authenticatedUserId) {
      logger.error('[Image Analysis] ❌ No authenticated user ID found');
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'User ID not found in request'
      });
    }

    // ✅ TIER ENFORCEMENT: Use tier from middleware (Core/Studio only)
    // tierGateMiddleware already validates tier, but we still need to check feature access
    if (tier === 'free') {
      logger.warn(`[Image Analysis] Access denied for free tier user: ${authenticatedUserId}`);
      return res.status(403).json({ 
        error: 'Image analysis requires Core or Studio tier',
        upgradeRequired: true,
        feature: 'image_analysis',
        tier: 'free',
        message: 'Upgrade to Core tier ($19.99/month) to unlock image analysis and other advanced features.'
      });
    }

    // ✅ BEST PRACTICE: Validate image URL format
    try {
      const urlObj = new URL(imageUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return res.status(400).json({ 
          error: 'Invalid image URL',
          details: 'Image URL must use HTTP or HTTPS protocol'
        });
      }
    } catch (urlError) {
      logger.warn('[Image Analysis] Invalid URL format:', imageUrl?.substring(0, 50));
      return res.status(400).json({ 
        error: 'Invalid image URL format',
        details: 'Please provide a valid HTTP/HTTPS URL'
      });
    }

    logger.debug(`[Image Analysis] 🚀 Starting analysis for tier ${tier} user ${authenticatedUserId} with URL-based approach (no download needed)`);

    // ✅ CRITICAL: Check if ANTHROPIC_API_KEY is configured
    if (!ANTHROPIC_API_KEY || (typeof ANTHROPIC_API_KEY === 'string' && ANTHROPIC_API_KEY.trim() === '')) {
      logger.error('[Image Analysis] ❌ ANTHROPIC_API_KEY is missing - image analysis unavailable', {
        hasKey: !!ANTHROPIC_API_KEY,
        keyType: typeof ANTHROPIC_API_KEY
      });
      return res.status(503).json({ 
        error: 'Image analysis service is not configured',
        details: 'ANTHROPIC_API_KEY is missing. Please add it to Railway environment variables.',
        requiresConfiguration: true
      });
    }

    // ✅ Request ID already generated at top of endpoint
    logger.debug(`[Image Analysis] Processing request (Request ID: ${requestId})`);

    // ✅ PERFORMANCE FIX: Use URL directly instead of downloading and converting to base64
    // This saves memory, bandwidth, and processing time (33% payload reduction)
    
    // ✅ BEST PRACTICE: Call Claude Vision API with timeout, retry logic, and exponential backoff
    let response;
    let lastError;
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 30000; // 30 seconds timeout per attempt
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      let timeoutId = null; // ✅ FIX: Declare outside try block for proper cleanup
      try {
        // ✅ BEST PRACTICE: Use AbortController for timeout handling
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        
        logger.debug(`[Image Analysis] Attempt ${attempt}/${MAX_RETRIES} (Request ID: ${requestId})`);
        
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
            body: JSON.stringify({
              model: selectedModel, // ✅ Use model from tierGateMiddleware (already optimized)
              max_tokens: 2000,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: prompt
                  },
                  {
                    type: 'image',
                    source: {
                      type: 'url',
                      url: imageUrl  // ✅ Direct URL - no download/encoding needed!
                    }
                  }
                ]
              }
            ]
          }),
          signal: controller.signal,
          agent: httpsAgent // ✅ Use custom agent for better connection handling
        });
        
        if (timeoutId) clearTimeout(timeoutId);

        if (response.ok) {
          logger.debug(`✅ [Image Analysis] Claude Vision API call successful on attempt ${attempt} (Request ID: ${requestId})`);
          break; // Success, exit retry loop
        } else {
          const errorText = await response.text().catch(() => 'Claude Vision API error');
          lastError = { status: response.status, message: errorText };
          
          // ✅ BEST PRACTICE: Don't retry on 4xx errors (client errors)
          if (response.status >= 400 && response.status < 500) {
            logger.warn(`[Image Analysis] Client error (${response.status}), not retrying`);
            break;
          }
          
          // ✅ BEST PRACTICE: Exponential backoff for retries
          if (attempt < MAX_RETRIES) {
            const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
            logger.debug(`[Image Analysis] Retrying in ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      } catch (fetchError) {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          lastError = { status: 0, message: `Request timeout after ${TIMEOUT_MS}ms` };
          logger.warn(`[Image Analysis] Request timeout on attempt ${attempt}`);
        } else {
          lastError = { status: 0, message: fetchError.message };
        }
        
        // ✅ BEST PRACTICE: Exponential backoff for retries
        if (attempt < MAX_RETRIES) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          logger.debug(`[Image Analysis] Network error, retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    if (!response || !response.ok) {
      // ✅ BEST PRACTICE: Structured error handling with proper categorization
      const errorStatus = response?.status || (lastError?.status ?? 0);
      const errorMessage = lastError?.message || (typeof lastError === 'string' ? lastError : JSON.stringify(lastError)) || 'Unknown error';
      const errorText = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
      
      // ✅ BEST PRACTICE: Categorize errors for proper HTTP status codes
      const isAuthError = errorStatus === 401 || errorStatus === 403 || 
                         errorText?.toLowerCase().includes('authentication') || 
                         errorText?.toLowerCase().includes('invalid_api_key') ||
                         errorText?.toLowerCase().includes('unauthorized');
      const isRateLimit = errorStatus === 429 || errorText?.toLowerCase().includes('rate_limit');
      const isTimeout = errorStatus === 0 || errorText?.toLowerCase().includes('timeout') || errorText?.toLowerCase().includes('abort');
      const isNetworkError = !response || errorText?.toLowerCase().includes('fetch') || 
                            errorText?.toLowerCase().includes('network') || 
                            errorText?.toLowerCase().includes('econnrefused') ||
                            errorText?.toLowerCase().includes('enotfound');
      const isClientError = errorStatus >= 400 && errorStatus < 500;
      
      logger.error('[Image Analysis] Failed after retries:', {
        requestId,
        userId: authenticatedUserId,
        tier,
        attempt: MAX_RETRIES,
        errorStatus,
        errorMessage: errorText.substring(0, 200),
        imageUrl: imageUrl?.substring(0, 50) + '...',
        isAuthError,
        isRateLimit,
        isTimeout,
        isNetworkError,
        isClientError
      });
      
      // ✅ BEST PRACTICE: Return appropriate HTTP status codes based on error type
      if (isAuthError) {
        return res.status(503).json({ 
          error: 'Image analysis service configuration error',
          details: 'The image analysis service is not properly configured. Please contact support.',
          requiresConfiguration: true,
          requestId
        });
      }
      
      if (isRateLimit) {
        return res.status(429).json({ 
          error: 'Image analysis rate limit exceeded',
          details: 'Too many image analysis requests. Please try again in a few minutes.',
          retryAfter: 60,
          requestId
        });
      }
      
      if (isTimeout) {
        return res.status(504).json({ 
          error: 'Image analysis request timeout',
          details: 'The image analysis request took too long. Please try again with a smaller image.',
          requestId
        });
      }
      
      if (isNetworkError) {
        return res.status(503).json({ 
          error: 'Image analysis service temporarily unavailable',
          details: 'Network error connecting to image analysis service. Please try again in a few minutes.',
          requestId
        });
      }
      
      if (isClientError) {
        return res.status(errorStatus).json({ 
          error: 'Image analysis request failed',
          details: errorText || 'Invalid request to image analysis service',
          requestId
        });
      }
      
      return res.status(500).json({ 
        error: 'Image analysis failed',
        details: errorText || 'Unknown error occurred during image analysis',
        requestId
      });
    }

    // ✅ SAFE: Parse response with error handling
    let result;
    try {
      const responseText = await response.text();
      result = JSON.parse(responseText);
    } catch (jsonError) {
      logger.error('[Image Analysis] Failed to parse Claude API response as JSON:', {
        error: jsonError.message,
        status: response.status,
        statusText: response.statusText,
        requestId
      });
      return res.status(500).json({
        error: 'Invalid response from image analysis service',
        details: 'The service returned an invalid response format',
        requestId
      });
    }
    
    // ✅ SAFE: Extract analysis with proper error handling
    let analysis;
    try {
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        analysis = result.content[0].text || result.content[0]?.text || '';
      } else {
        throw new Error('Invalid response structure from Claude API');
      }
    } catch (parseError) {
      logger.error('[Image Analysis] Failed to extract analysis from Claude response:', {
        error: parseError.message,
        result: JSON.stringify(result).substring(0, 500),
        requestId
      });
      return res.status(500).json({
        error: 'Failed to extract image analysis',
        details: 'The service returned an unexpected response format',
        requestId
      });
    }
    
    if (!analysis || !analysis.trim()) {
      logger.error('[Image Analysis] Empty analysis result from Claude', { requestId });
      return res.status(500).json({
        error: 'Empty analysis result',
        details: 'The image analysis service returned an empty result',
        requestId
      });
    }

    logger.debug('✅ [Image Analysis] Analysis complete');

    // ✅ TOKEN TRACKING: Extract and log usage for cost tracking
    let tokenUsage = { input_tokens: 0, output_tokens: 0 };
    if (result.usage) {
      tokenUsage = {
        input_tokens: result.usage.input_tokens || 0,
        output_tokens: result.usage.output_tokens || 0
      };
      
      // Log to usage_logs table
      try {
        const { estimateRequestCost } = await import('./config/intelligentTierSystem.mjs');
        const cost = estimateRequestCost(selectedModel, tokenUsage.input_tokens, tokenUsage.output_tokens);
        
        await supabase.from('usage_logs').insert({
          user_id: authenticatedUserId,
          event: 'image_analysis',
          tier: tier, // ✅ Explicit column (best practice)
          feature: 'image_analysis',
          tokens_used: tokenUsage.input_tokens + tokenUsage.output_tokens,
          estimated_cost: cost,
          metadata: {
            model: selectedModel,
            input_tokens: tokenUsage.input_tokens,
            output_tokens: tokenUsage.output_tokens
          },
          created_at: new Date().toISOString()
        }).catch(err => {
          logger.warn('[Image Analysis] Failed to log usage:', err.message);
        });
        
        logger.debug(`[Image Analysis] ✅ Logged ${tokenUsage.input_tokens + tokenUsage.output_tokens} tokens, cost: $${cost.toFixed(6)}`);
      } catch (logError) {
        logger.warn('[Image Analysis] Error logging token usage:', logError.message);
        // Don't fail the request if logging fails
      }
    }

    // ✅ NEW: Save user image message to conversation history
    const conversationId = req.body.conversationId || null;

    // ✅ SAFETY: Check for empty string conversationId
    if (conversationId && conversationId.trim() && authenticatedUserId && supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        // Save user's image message
        const { error: userMsgError } = await supabase
          .from('messages')
          .insert({
            user_id: authenticatedUserId,
            conversation_id: conversationId,
            role: 'user',
            content: prompt,
            // ✅ FIX: Use ONLY attachments array, not both image_url and attachments
            attachments: [{ type: 'image', url: imageUrl }],
            created_at: new Date().toISOString()
          });

        if (userMsgError) {
          logger.error('[Image Analysis] Failed to save user message:', userMsgError.message);
        } else {
          logger.debug('✅ [Image Analysis] Saved user image message');
        }

        // Save AI analysis response
        const { error: aiMsgError } = await supabase
          .from('messages')
          .insert({
            user_id: authenticatedUserId,
            conversation_id: conversationId,
            role: 'assistant',
            content: analysis,
            created_at: new Date().toISOString()
          });

        if (aiMsgError) {
          logger.error('[Image Analysis] Failed to save AI response:', aiMsgError.message);
        } else {
          logger.debug('✅ [Image Analysis] Saved AI response');
        }
      } catch (saveError) {
        logger.error('[Image Analysis] Error saving messages:', saveError.message);
        // Continue - don't fail the request if save fails
      }
    }

    // Store analysis in database (optional)
    if (supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        await supabase.from('image_analyses').insert({
          user_id: authenticatedUserId,
          image_url: imageUrl,
          analysis: analysis,
          prompt: prompt,
          created_at: new Date().toISOString()
        });
      } catch (dbError) {
        // Continue without failing the request
      }
    }

    res.json({
      success: true,
      analysis: analysis,
      imageUrl: imageUrl,
      model: selectedModel,
      tier: tier,
      tokens: tokenUsage,
      timestamp: new Date().toISOString(),
      requestId // ✅ BEST PRACTICE: Include request ID for tracing
    });

  } catch (error) {
    // ✅ CRITICAL: Ensure we always send a response, even if error handling fails
    const errorDetails = {
      requestId, // ✅ Use requestId from top of function
      error: error?.message || 'Unknown error',
      stack: error?.stack,
      name: error?.name,
      userId: req.user?.id,
      imageUrl: req.body?.imageUrl?.substring(0, 50) + '...',
      body: req.body ? JSON.stringify(req.body).substring(0, 200) : 'no body'
    };
    
    logger.error('[Image Analysis] Unexpected error:', errorDetails);
    
    // ✅ BEST PRACTICE: Always send a response, even if something goes wrong
    try {
      res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'production' 
          ? 'An error occurred processing your image. Please try again.' 
          : error?.message || 'Unknown error occurred',
        requestId: requestId || 'unknown'
      });
    } catch (sendError) {
      // If we can't send JSON, try to send plain text
      logger.error('[Image Analysis] Failed to send error response:', sendError);
      try {
        res.status(500).send('Internal server error');
      } catch (finalError) {
        // Last resort - connection might be closed
        logger.error('[Image Analysis] Failed to send any response:', finalError);
      }
    }
  }
});

// 📄 File analysis endpoint (PDF, DOCX, TXT, MP3, MP4)
app.post('/api/file-analysis', verifyJWT, imageAnalysisRateLimit, tierGateMiddleware, async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logger.debug('[File Analysis] Request received:', {
      requestId,
      hasBody: !!req.body,
      hasUser: !!req.user,
      userId: req.user?.id,
      fileUrl: req.body?.fileUrl?.substring(0, 50) + '...'
    });
    
    const { fileUrl, userId, prompt = "Please analyze this file and provide detailed insights about its content." } = req.body;
    const authenticatedUserId = req.user?.id;
    // ✅ Use tier from tierGateMiddleware (already validated)
    const tier = req.tier || 'free';
    const selectedModel = req.selectedModel || selectOptimalModel(tier, prompt, 'file_analysis');
    
    if (!fileUrl) {
      logger.warn('[File Analysis] Missing fileUrl in request');
      return res.status(400).json({ error: 'File URL is required' });
    }

    if (!authenticatedUserId) {
      logger.error('[File Analysis] ❌ No authenticated user ID found');
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'User ID not found in request'
      });
    }

    // ✅ TIER ENFORCEMENT: Use tier from middleware (Core/Studio only)
    if (tier === 'free') {
      logger.warn(`[File Analysis] Access denied for free tier user: ${authenticatedUserId}`);
      return res.status(403).json({ 
        error: 'File analysis requires Core or Studio tier',
        upgradeRequired: true,
        feature: 'file_analysis',
        tier: 'free',
        message: 'Upgrade to Core tier ($19.99/month) to unlock file analysis and other advanced features.'
      });
    }

    // ✅ Validate file URL format
    try {
      const urlObj = new URL(fileUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return res.status(400).json({ 
          error: 'Invalid file URL',
          details: 'File URL must use HTTP or HTTPS protocol'
        });
      }
    } catch (urlError) {
      logger.warn('[File Analysis] Invalid URL format:', fileUrl?.substring(0, 50));
      return res.status(400).json({ 
        error: 'Invalid file URL format',
        details: 'Please provide a valid HTTP/HTTPS URL'
      });
    }

    // Determine file type from URL
    const fileExtension = fileUrl.toLowerCase().split('.').pop() || '';
    const isTextFile = ['pdf', 'docx', 'doc', 'txt'].includes(fileExtension);
    const isAudioFile = ['mp3', 'mp4', 'wav', 'ogg'].includes(fileExtension);

    if (!isTextFile && !isAudioFile) {
      return res.status(400).json({ 
        error: 'Unsupported file type',
        details: 'Supported file types: PDF, DOCX, TXT, MP3, MP4'
      });
    }

    logger.debug(`[File Analysis] 🚀 Starting analysis for tier ${tier} user ${authenticatedUserId}`);

    // ✅ Check if ANTHROPIC_API_KEY is configured
    if (!ANTHROPIC_API_KEY || (typeof ANTHROPIC_API_KEY === 'string' && ANTHROPIC_API_KEY.trim() === '')) {
      logger.error('[File Analysis] ❌ ANTHROPIC_API_KEY is missing');
      return res.status(503).json({ 
        error: 'File analysis service is not configured',
        details: 'ANTHROPIC_API_KEY is missing. Please add it to Railway environment variables.',
        requiresConfiguration: true
      });
    }

    // For text files, we'll send the URL and let Claude fetch it
    // For audio files, we'd need transcription first (simplified for now - just send URL)
    const analysisPrompt = isTextFile 
      ? `${prompt}\n\nPlease analyze the content of this document file (${fileExtension.toUpperCase()}) and provide detailed insights.`
      : `${prompt}\n\nPlease analyze this audio file (${fileExtension.toUpperCase()}) and provide insights about its content, if possible.`;

    // Call Claude API
    let response;
    let lastError;
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 60000; // 60 seconds for file analysis
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      let timeoutId = null;
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        
        logger.debug(`[File Analysis] Attempt ${attempt}/${MAX_RETRIES} (Request ID: ${requestId})`);
        
        // For now, send file URL as text reference (Claude can't directly process files, but we can describe them)
        // In production, you'd want to extract text from PDF/DOCX or transcribe audio first
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: selectedModel,
            max_tokens: 2000,
            messages: [
              {
                role: 'user',
                content: `${analysisPrompt}\n\nFile URL: ${fileUrl}\nFile Type: ${fileExtension.toUpperCase()}\n\nNote: Please provide analysis based on the file type. For documents, describe what insights you would provide if you could read the content. For audio, describe what analysis would be possible.`
              }
            ]
          }),
          signal: controller.signal,
          agent: httpsAgent
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          logger.debug(`✅ [File Analysis] Success on attempt ${attempt}`);
          break;
        } else {
          lastError = await response.text().catch(() => 'Claude API error');
          logger.error(`❌ [File Analysis] Failed on attempt ${attempt}:`, lastError);
          
          if (attempt < MAX_RETRIES) {
            const backoffMs = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        lastError = fetchError.message;
        logger.error(`❌ [File Analysis] Network error on attempt ${attempt}:`, lastError);
        
        if (attempt < MAX_RETRIES) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    if (!response || !response.ok) {
      const errorStatus = response?.status || 0;
      const errorMessage = lastError?.message || (typeof lastError === 'string' ? lastError : JSON.stringify(lastError)) || 'Unknown error';
      
      logger.error('[File Analysis] Failed after retries:', {
        requestId,
        userId: authenticatedUserId,
        tier,
        errorStatus,
        errorMessage: errorMessage.substring(0, 200)
      });
      
      return res.status(500).json({ 
        error: 'File analysis failed',
        details: errorMessage || 'Unknown error occurred during file analysis',
        requestId
      });
    }

    // Parse response
    let result;
    try {
      const responseText = await response.text();
      result = JSON.parse(responseText);
    } catch (jsonError) {
      logger.error('[File Analysis] Failed to parse Claude API response:', jsonError.message);
      return res.status(500).json({
        error: 'Invalid response from file analysis service',
        details: 'The service returned an invalid response format',
        requestId
      });
    }
    
    // Extract analysis
    let analysis;
    try {
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        analysis = result.content[0].text || '';
      } else {
        throw new Error('Invalid response structure from Claude API');
      }
    } catch (parseError) {
      logger.error('[File Analysis] Failed to extract analysis:', parseError.message);
      return res.status(500).json({
        error: 'Failed to extract file analysis',
        details: 'The service returned an unexpected response format',
        requestId
      });
    }
    
    if (!analysis || !analysis.trim()) {
      logger.error('[File Analysis] Empty analysis result', { requestId });
      return res.status(500).json({
        error: 'Empty analysis result',
        details: 'The file analysis service returned an empty result',
        requestId
      });
    }

    logger.debug('✅ [File Analysis] Analysis complete');

    // ✅ TOKEN TRACKING: Extract and log usage for cost tracking
    let tokenUsage = { input_tokens: 0, output_tokens: 0 };
    if (result.usage) {
      tokenUsage = {
        input_tokens: result.usage.input_tokens || 0,
        output_tokens: result.usage.output_tokens || 0
      };
      
      // Log to usage_logs table
      try {
        const { estimateRequestCost } = await import('./config/intelligentTierSystem.mjs');
        const cost = estimateRequestCost(selectedModel, tokenUsage.input_tokens, tokenUsage.output_tokens);
        
        await supabase.from('usage_logs').insert({
          user_id: authenticatedUserId,
          event: 'file_analysis',
          tier: tier, // ✅ Explicit column (best practice)
          feature: 'file_analysis',
          tokens_used: tokenUsage.input_tokens + tokenUsage.output_tokens,
          estimated_cost: cost,
          metadata: {
            model: selectedModel,
            input_tokens: tokenUsage.input_tokens,
            output_tokens: tokenUsage.output_tokens,
            file_type: fileExtension
          },
          created_at: new Date().toISOString()
        }).catch(err => {
          logger.warn('[File Analysis] Failed to log usage:', err.message);
        });
        
        logger.debug(`[File Analysis] ✅ Logged ${tokenUsage.input_tokens + tokenUsage.output_tokens} tokens, cost: $${cost.toFixed(6)}`);
      } catch (logError) {
        logger.warn('[File Analysis] Error logging token usage:', logError.message);
        // Don't fail the request if logging fails
      }
    }

    // Save to conversation history if conversationId provided
    const conversationId = req.body.conversationId || null;
    if (conversationId && conversationId.trim() && authenticatedUserId && supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        // Save user's file message
        await supabase.from('messages').insert({
          user_id: authenticatedUserId,
          conversation_id: conversationId,
          role: 'user',
          content: prompt,
          attachments: [{ type: 'file', url: fileUrl }],
          created_at: new Date().toISOString()
        });

        // Save AI analysis response
        await supabase.from('messages').insert({
          user_id: authenticatedUserId,
          conversation_id: conversationId,
          role: 'assistant',
          content: analysis,
          created_at: new Date().toISOString()
        });
      } catch (saveError) {
        logger.error('[File Analysis] Error saving messages:', saveError.message);
      }
    }

    res.json({
      success: true,
      analysis: analysis,
      fileUrl: fileUrl,
      fileType: fileExtension,
      tier: tier,
      model: selectedModel,
      tokens: tokenUsage,
      timestamp: new Date().toISOString(),
      requestId
    });

  } catch (error) {
    const errorDetails = {
      requestId,
      error: error?.message || 'Unknown error',
      stack: error?.stack,
      name: error?.name,
      userId: req.user?.id,
      fileUrl: req.body?.fileUrl?.substring(0, 50) + '...'
    };
    
    logger.error('[File Analysis] Unexpected error:', errorDetails);
    
    try {
      res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'production' 
          ? 'An error occurred processing your file. Please try again.' 
          : error?.message || 'Unknown error occurred',
        requestId: requestId || 'unknown'
      });
    } catch (sendError) {
      logger.error('[File Analysis] Failed to send error response:', sendError);
    }
  }
});

// 🎙️ Audio transcription endpoint using OpenAI Whisper
app.post('/api/transcribe', verifyJWT, tierGateMiddleware, async (req, res) => {
  try {
    const { audioUrl, language = 'en' } = req.body;
    const userId = req.user.id;
    // ✅ Use tier from tierGateMiddleware (already validated)
    const tier = req.tier || 'free';
    
    if (!audioUrl) {
      return res.status(400).json({ error: 'Audio URL is required' });
    }

    // ✅ TIER ENFORCEMENT: Use tier from middleware (Core/Studio only)
    if (tier === 'free') {
      return res.status(403).json({ 
        error: 'Audio transcription requires Core or Studio tier',
        upgradeRequired: true,
        feature: 'audio_transcription',
        tier: 'free'
      });
    }

    if (!openai) {
      return res.status(503).json({ error: 'Audio transcription service unavailable' });
    }


    // Download audio file from Supabase Storage
    let audioBuffer;
    try {
      const audioResponse = await fetch(audioUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
        }
      });
      
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`);
      }
      
      audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      logger.debug(`✅ [Transcribe] Audio downloaded: ${audioBuffer.length} bytes`);
    } catch (downloadError) {
      return res.status(400).json({ 
        error: 'Failed to download audio file',
        details: downloadError.message
      });
    }

    // Create a temporary file for Whisper API (it requires a file, not buffer)
    const { writeFile, unlink } = await import('fs/promises');
    const tmpFile = path.join('/tmp', `audio_${Date.now()}.webm`);
    
    try {
      await writeFile(tmpFile, audioBuffer);
      
      // Transcribe with OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: await import('fs').then(fs => fs.createReadStream(tmpFile)),
        model: 'whisper-1',
        language: language,
        response_format: 'verbose_json'
      });
      
      logger.debug(`✅ [Transcribe] Transcription complete: "${transcription.text.slice(0, 50)}..."`);
      
      // Clean up temp file
      await unlink(tmpFile).catch(() => {});
      
      // Store transcription in database for usage tracking
      if (supabaseUrl !== 'https://your-project.supabase.co') {
        try {
          const duration = transcription.duration || 0;
          
          // Fetch current profile to get usage stats
          const { data: profile } = await supabase
            .from('profiles')
            .select('usage_stats')
            .eq('id', userId)
            .single();
          
          // Track audio usage (in minutes)
          const currentUsage = profile?.usage_stats?.audio_minutes_used || 0;
          const newUsage = currentUsage + (duration / 60);
          
          await supabase.from('profiles').update({
            usage_stats: {
              ...(profile?.usage_stats || {}),
              audio_minutes_used: Math.ceil(newUsage)
            }
          }).eq('id', userId);
          
        } catch (dbError) {
          logger.error('[Server] Error updating audio usage stats:', dbError.message || dbError);
        }
      }
      
      res.json({
        transcript: transcription.text,
        confidence: 1.0, // Whisper doesn't provide confidence scores
        language: transcription.language || language,
        duration: transcription.duration || 0
      });
      
    } catch (whisperError) {
      await unlink(tmpFile).catch(() => {});
      
      return res.status(500).json({ 
        error: 'Transcription failed',
        details: whisperError.message
      });
    }
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// 🚀 DEEPGRAM STT - 22x faster than Whisper (300ms vs 6.8s)
app.post('/api/stt-deepgram', verifyJWT, tierGateMiddleware, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { audio } = req.body; // base64 audio (without data:audio/webm;base64, prefix)
    const userId = req.user.id;
    // ✅ Use tier from tierGateMiddleware (already validated)
    const tier = req.tier || 'free';
    
    if (!audio) {
      return res.status(400).json({ error: 'Audio data required' });
    }
    
    // ✅ TIER ENFORCEMENT: Use tier from middleware (Core/Studio only)
    if (tier === 'free') {
      logger.warn(`[Deepgram STT] Access denied for free tier user: ${userId}`);
      return res.status(403).json({ 
        error: 'Speech-to-text requires Core or Studio tier',
        upgradeRequired: true,
        feature: 'speech_to_text',
        tier: 'free',
        message: 'Upgrade to Core tier ($19.99/month) to unlock speech-to-text and other advanced features.'
      });
    }
    
    // Check Deepgram API key
    const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
    if (!DEEPGRAM_API_KEY) {
      logger.error('[Deepgram] ⚠️ API key not configured - STT service unavailable');
      logger.error('[Deepgram] Add DEEPGRAM_API_KEY to Railway environment variables');
      return res.status(503).json({ 
        error: 'STT service not configured',
        message: 'Speech-to-text service is temporarily unavailable. Please contact support.',
        requiresConfiguration: true
      });
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    logger.debug(`[Deepgram] Processing ${(audioBuffer.length / 1024).toFixed(1)}KB audio`);
    
    // Call Deepgram API
    // Deepgram auto-detects format, but we'll hint at webm
    const deepgramResponse = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en&punctuate=true&utterances=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/webm', // Deepgram will auto-detect if different
        },
        body: audioBuffer,
      }
    );
    
    if (!deepgramResponse.ok) {
      const error = await deepgramResponse.text();
      logger.error('[Deepgram] API error:', error);
      return res.status(deepgramResponse.status).json({ 
        error: 'Transcription failed',
        details: error 
      });
    }
    
    const result = await deepgramResponse.json();
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    const duration = result.metadata?.duration || 0;
    const latency = Date.now() - startTime;
    
    logger.info(`[Deepgram] ✅ STT success: "${transcript.substring(0, 50)}...", ${latency}ms, confidence: ${(confidence * 100).toFixed(1)}%`);
    
    // Log usage for cost tracking
    if (supabaseUrl !== 'https://your-project.supabase.co') {
      try {
        await supabase.from('usage_logs').insert({
          user_id: userId,
          event: 'stt_deepgram',
          tier: tier, // ✅ Explicit column (best practice)
          feature: 'speech_to_text',
          estimated_cost: duration * 0.0125 / 60, // $0.0125 per minute
          metadata: {
            transcript_length: transcript.length,
            audio_duration: duration,
            latency_ms: latency,
            confidence: confidence
          },
          created_at: new Date().toISOString()
        });
      } catch (logError) {
        logger.error('[Deepgram] Failed to log usage:', logError.message);
      }
    }
    
    res.json({ 
      text: transcript,
      confidence: confidence,
      duration_seconds: duration,
      latency_ms: latency
    });
    
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.error(`[Deepgram] Error: ${error.message}, ${latency}ms`);
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});

// 🔊 Text-to-speech endpoint using OpenAI TTS
app.post('/api/synthesize', verifyJWT, tierGateMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.user.id;
    // ✅ Use tier from tierGateMiddleware (already validated)
    const tier = req.tier || 'free';
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // ✅ TIER ENFORCEMENT: Use tier from middleware (Core/Studio only)
    if (tier === 'free') {
      return res.status(403).json({ 
        error: 'Text-to-speech requires Core or Studio tier',
        upgradeRequired: true,
        feature: 'text_to_speech',
        tier: 'free'
      });
    }

    if (!openai) {
      return res.status(503).json({ error: 'Text-to-speech service unavailable' });
    }

    // 🎯 Tier-based model selection (temporarily using core tier settings)
    // Core: tts-1 (faster, cheaper)
    // Studio: tts-1-hd (higher quality)
    const model = 'tts-1'; // Always use standard quality for testing
    const voice = 'alloy'; // Always use alloy voice for testing


    try {
      // Generate speech with OpenAI TTS
      const mp3 = await openai.audio.speech.create({
        model: model,
        voice: voice,
        input: text.trim(),
        speed: 1.0
      });

      // Convert stream to buffer
      const audioBuffer = Buffer.from(await mp3.arrayBuffer());
      
      logger.debug(`✅ [Synthesize] Audio generated: ${audioBuffer.length} bytes`);
      
      // Return audio as base64 (for easy frontend handling)
      const audioBase64 = audioBuffer.toString('base64');
      
      res.json({
        success: true,
        audio: audioBase64,
        format: 'mp3',
        size: audioBuffer.length,
        model: model,
        voice: voice
      });
      
    } catch (openaiError) {
      return res.status(500).json({ 
        error: 'Speech synthesis failed',
        details: openaiError.message
      });
    }
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Get conversation messages
app.get('/api/conversations/:conversationId/messages', 
  verifyJWT, 
  cacheTierMiddleware,
  apiCacheMiddleware({ ttlCategory: 'messages', varyByTier: true }),
  async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { since } = req.query;

    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (since) {
      // Accept ISO string or numeric timestamp
      let sinceIso = '';
      if (typeof since === 'string') {
        const num = Number(since);
        if (!Number.isNaN(num) && num > 0) {
          sinceIso = new Date(num).toISOString();
        } else {
          // assume ISO
          sinceIso = new Date(since).toISOString();
        }
      }
      if (sinceIso && !Number.isNaN(Date.parse(sinceIso))) {
        query = query.gt('created_at', sinceIso);
      }
    }

    const { data: messages, error } = await query.order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    res.json({ messages });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// MailerLite webhook route for event automation
app.post('/api/mailerlite/event', async (req, res) => {
  try {
    const { email, event, properties = {} } = req.body;
    
    if (!email || !event) {
      return res.status(400).json({ 
        error: 'Missing required fields: email and event' 
      });
    }


    // Get MailerLite API key from environment
    const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
    
    if (!MAILERLITE_API_KEY) {
      return res.status(500).json({ 
        error: 'MailerLite service not configured' 
      });
    }

    // Trigger event via MailerLite v2 API
    const response = await fetch(`https://api.mailerlite.com/api/v2/subscribers/${email}/actions/${event}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
      },
      body: JSON.stringify({
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          source: 'atlas_backend',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `MailerLite API error: ${response.status}`);
    }

    const result = await response.json();
    
    logger.debug(`✅ MailerLite event ${event} triggered successfully for ${email}`);
    
    res.json({ 
      success: true, 
      message: `Event ${event} triggered successfully`,
      data: result 
    });

  } catch (error) {
    
    res.status(500).json({ 
      error: 'Failed to trigger MailerLite event',
      details: error.message 
    });
  }
});

// MailerLite subscriber sync route
app.post('/api/mailerlite/subscriber', async (req, res) => {
  try {
    const { email, name, conversations_today, total_conversations } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Missing required fields: email' 
      });
    }

    // ✅ SECURITY: Fetch tier from database (never trust client-sent tier)
    let tier = 'free'; // Default
    if (req.user?.id) {
      // If authenticated, use verified tier from authMiddleware
      tier = req.user.tier || 'free';
    } else {
      // If not authenticated, fetch tier by email from database
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('email', email)
          .single();
        tier = profile?.subscription_tier || 'free';
      } catch (dbError) {
        logger.debug('[MailerLite] Could not fetch tier for email:', email);
        tier = 'free'; // Fail closed
      }
    }

    const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
    
    if (!MAILERLITE_API_KEY) {
      return res.status(500).json({ 
        error: 'MailerLite service not configured' 
      });
    }

    // Tier group mapping
    const tierGroupMapping = {
      free: 'atlas_free_users',
      core: 'atlas_premium_monthly',
      studio: 'atlas_premium_yearly',
      complete: 'atlas_complete_bundle',
    };

    const targetGroup = tierGroupMapping[tier];
    
    // Create or update subscriber via v2 API
    const subscriberData = {
      email,
      name: name || '',
      fields: {
        tier,
        conversations_today: conversations_today || 0,
        total_conversations: total_conversations || 0,
        last_active: new Date().toISOString(),
        signup_date: new Date().toISOString(),
        subscription_status: 'active',
      },
      resubscribe: true,
    };

    // Check if subscriber exists and create/update
    const createResponse = await fetch('https://api.mailerlite.com/api/v2/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
      },
      body: JSON.stringify(subscriberData),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(`Failed to create/update subscriber: ${createResponse.status} - ${errorData.message || 'Unknown error'}`);
    }

    const result = await createResponse.json();
    logger.debug(`✅ Subscriber ${email} synced successfully`);

    // Add to appropriate group
    if (targetGroup) {
      try {
        await fetch(`https://api.mailerlite.com/api/v2/groups/${targetGroup}/subscribers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          },
          body: JSON.stringify({ email }),
        });
        logger.debug(`✅ Subscriber ${email} added to group ${targetGroup}`);
      } catch (groupError) {
        logger.error('[Server] Error adding subscriber to group:', groupError.message || groupError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Subscriber synced successfully',
      data: result 
    });

  } catch (error) {
    
    res.status(500).json({ 
      error: 'Failed to sync subscriber',
      details: error.message 
    });
  }
});

// User profile endpoint with fallback creation
app.get('/v1/user_profiles/:id', verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    // User is already verified by JWT middleware
    const authUser = req.user;
    
    if (!authUser?.id) {
      return res.status(401).json({ error: 'Missing or invalid authenticated user.' });
    }

    // Then fetch or create user_profile safely
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();


    if (error && error.code === 'PGRST116') {
      // Create fallback profile if missing
      const profileData = {
        id: userId,
        email: `user-${userId}@atlas.dev`,
        preferences: {},
        subscription_tier: 'free'
      };
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([profileData])
        .select()
        .single();


      if (createError) {
        return res.status(500).json({ error: "Failed to create user profile", details: createError });
      }

      logger.debug(`✅ Created fallback profile for user: ${userId}`);
      return res
        .set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        .set('Pragma', 'no-cache')
        .set('Expires', '0')
        .status(200)
        .json(newProfile);
    }

    if (error) {
      return res.status(500).json({ error: "Database error", details: error });
    }

    return res
      .set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .status(200)
      .json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user profile endpoint
app.post('/v1/user_profiles', verifyJWT, async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // Extract the Bearer token from the Authorization header
    const token = req.headers['authorization']?.replace('Bearer ', '').trim();
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided.' });
    }

    // Pass token explicitly to Supabase client
    const { data: authUser, error: authError } = await supabase.auth.getUser(token);
    
    // Handle Supabase errors or missing user
    if (authError || !authUser?.user?.id) {
      return res.status(401).json({ error: 'Missing or invalid authenticated user.' });
    }

    const profileData = {
      id: user_id,
      email: `user-${user_id}@atlas.dev`,
      preferences: {},
      subscription_tier: 'free'
    };

    const { data: newProfile, error: createError } = await supabase
      .from("profiles")
      .insert([profileData])
      .select()
      .single();


    if (createError) {
      return res.status(500).json({ error: "Failed to create user profile", details: createError });
    }

    logger.debug(`✅ Created user profile for user: ${user_id}`);
    return res
      .set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .status(201)
      .json(newProfile);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🔒 SECURITY FIX: REMOVED public tier update endpoint
// ❌ This endpoint allowed anyone to upgrade their tier without payment
// ✅ Tier updates now ONLY happen via FastSpring webhook with signature verification
// 
// Previously at: app.put('/v1/user_profiles/:id', ...)
// Removed for security: Users must not be able to modify their own subscription_tier

// FastSpring checkout creation endpoint
app.post('/api/fastspring/create-checkout', async (req, res) => {
  try {
    const { userId, tier: requestedTier, email, productId, successUrl, cancelUrl } = req.body;

    if (!userId || !requestedTier || !email || !productId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // ✅ SECURITY: Validate tier exists and fetch actual tier from database
    const validTiers = ['free', 'core', 'studio'];
    if (!validTiers.includes(requestedTier)) {
      return res.status(400).json({ error: 'Invalid tier specified' });
    }

    // Fetch actual tier from database (single source of truth)
    let tier = requestedTier; // Default to requested tier
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      
      // Use actual tier if available, otherwise use requested tier (for new signups)
      tier = profile?.subscription_tier || requestedTier;
    } catch (dbError) {
      logger.debug('[FastSpring] Could not fetch tier for userId:', userId);
      // Use requested tier as fallback (this is OK for checkout creation)
      tier = requestedTier;
    }

    const FASTSPRING_API_USERNAME = process.env.FASTSPRING_API_USERNAME;
    const FASTSPRING_API_PASSWORD = process.env.FASTSPRING_API_PASSWORD;
    const FASTSPRING_STORE_ID = process.env.FASTSPRING_STORE_ID;
    const FASTSPRING_ENVIRONMENT = process.env.VITE_FASTSPRING_ENVIRONMENT || 'test';
    
    if (!FASTSPRING_API_USERNAME || !FASTSPRING_API_PASSWORD || !FASTSPRING_STORE_ID) {
      return res.status(500).json({ error: 'FastSpring API credentials not configured' });
    }

    // Use test or production API based on environment
    // Note: FastSpring uses the same API endpoint, test vs live is determined by store settings
    const apiBaseUrl = 'https://api.fastspring.com';

    // Create FastSpring checkout session with Basic Auth
    const authString = Buffer.from(`${FASTSPRING_API_USERNAME}:${FASTSPRING_API_PASSWORD}`).toString('base64');
    
    logger.info(`[FastSpring] Creating checkout for ${productId}`);
    
    const fastspringResponse = await fetch(`${apiBaseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: [
          {
            path: productId,
            quantity: 1
          }
        ],
        contact: {
          email: email,
          firstName: 'Atlas',
          lastName: 'User'
        },
        tags: {
          user_id: userId,
          tier: tier
        },
        redirectUrls: {
          success: successUrl,
          cancel: cancelUrl
        }
      })
    });

    if (!fastspringResponse.ok) {
      const error = await fastspringResponse.text();
      logger.error(`[FastSpring] API Error (${fastspringResponse.status}):`, error);
      return res.status(500).json({ 
        error: 'Failed to create checkout session', 
        status: fastspringResponse.status,
        details: error 
      });
    }

    const checkoutData = await fastspringResponse.json();
    
    // Log the full response to see what FastSpring returns
    logger.info(`[FastSpring] API Response:`, JSON.stringify(checkoutData));
    
    // FastSpring Sessions API should return the checkout URL directly
    // If not, we need to construct it ourselves
    let checkoutUrl = checkoutData.url || checkoutData.checkoutUrl;
    
    if (!checkoutUrl && checkoutData.id) {
      // Fallback: construct URL manually
      const storeDomain = FASTSPRING_STORE_ID.replace(/_/g, '-');
      const storefront = FASTSPRING_ENVIRONMENT === 'live' 
        ? `https://${storeDomain}.onfastspring.com`
        : `https://${storeDomain}.test.onfastspring.com`;
      checkoutUrl = `${storefront}/popup-${checkoutData.id}`;
    }
    
    logger.info(`[FastSpring] Checkout created: ${checkoutUrl}`);
    
    return res.status(200).json({
      checkoutUrl: checkoutUrl,
      sessionId: checkoutData.id
    });

  } catch (error) {
    logger.error('[FastSpring] Checkout creation error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// 📊 Feature attempts tracking endpoint
app.post('/api/feature-attempts', async (req, res) => {
  try {
    const { userId, feature } = req.body;

    // Validate required fields
    if (!userId || !feature) {
      return res.status(400).json({ 
        error: "Missing required fields: userId, feature" 
      });
    }

    // ✅ SECURITY: Fetch tier from database (never trust client-sent tier)
    let tier = 'free'; // Default
    if (req.user?.id && req.user.id === userId) {
      // If authenticated and userId matches, use verified tier from authMiddleware
      tier = req.user.tier || 'free';
    } else {
      // If not authenticated or userId mismatch, fetch tier from database
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', userId)
          .single();
        tier = profile?.subscription_tier || 'free';
      } catch (dbError) {
        logger.debug('[FeatureAttempts] Could not fetch tier for userId:', userId);
        tier = 'free'; // Fail closed
      }
    }

    // Skip logging in development if table doesn't exist
    if (supabaseUrl === 'https://your-project.supabase.co') {
      return res.json({ status: "ok", dev: true });
    }

    const { error } = await supabase
      .from("feature_attempts")
      .insert({
        user_id: userId,
        feature,
        tier,
        created_at: new Date().toISOString()
      });

    if (error) {
      // If table doesn't exist, just log and continue (non-critical)
      return res.json({ status: "ok", warning: "Table not found" });
    }

    res.json({ status: "ok" });
  } catch (err) {
    // Return success anyway - this is non-critical telemetry
    res.json({ status: "ok", error: err.message });
  }
});

// Debug endpoint to check what files Railway actually has
app.get('/debug/dist-files', (req, res) => {
  const distPath = path.join(__dirname, '..', 'dist');
  const assetsPath = path.join(distPath, 'assets');
  try {
    const files = fs.readdirSync(assetsPath);
    const indexFiles = files.filter(f => f.startsWith('index-') && f.endsWith('.js'));
    res.json({
      distPath,
      assetsPath,
      indexFiles,
      buildTimestamp: fs.existsSync(path.join(distPath, '.build-timestamp'))
        ? fs.readFileSync(path.join(distPath, '.build-timestamp'), 'utf8')
        : 'not found'
    });
  } catch (err) {
    res.json({ error: err.message, distPath, assetsPath: assetsPath });
  }
});

// ✅ CRITICAL FIX: Railway backend should ONLY serve API endpoints, not frontend static files
// Frontend is deployed separately on Vercel (atlas-xi-tawny.vercel.app)
// Only serve static files in local development (not on Railway)
if (!process.env.RAILWAY_ENVIRONMENT && process.env.NODE_ENV !== 'production') {
  // Local development: serve frontend for convenience
  app.use(express.static(path.join(__dirname, '..', 'dist'), {
    maxAge: 0,
    etag: false,
    lastModified: false
  }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  
  // Fallback route for local dev only
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/message') && !req.path.startsWith('/healthz')) {
      res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  });
} else {
  // Production (Railway): Only serve API endpoints - return 404 for frontend routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/message') || req.path.startsWith('/healthz')) {
      res.status(404).json({ error: 'API route not found' });
    } else {
      // Frontend routes should go to Vercel, not Railway
      res.status(404).json({ 
        error: 'Frontend not served from Railway',
        message: 'Please access the frontend at https://atlas-xi-tawny.vercel.app',
        backendApi: 'https://atlas-production-2123.up.railway.app/api'
      });
    }
  });
}

// Sentry error handler must be after all other middleware and routes
app.use(sentryMiddleware.errorHandler);

// Global error handler (after Sentry)
app.use((err, req, res, next) => {
  // Log the error
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id
  });

  // Send error response
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    // Only send stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    // Stop keep-alive ping
    stopKeepAlive();
    
    // Flush Sentry before exit
    await flushSentry();
    
    // Close Redis connection
    await redisService.shutdown();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ✅ STARTUP: Verify Anthropic config before starting server
async function startServer() {
  // ✅ NON-BLOCKING: Start verification in background, don't block server startup
  // Server will start even if verification fails (allows healthcheck to work)
  if (process.env.RAILWAY_ENVIRONMENT || process.env.VERIFY_ANTHROPIC !== 'false') {
    verifyAnthropicConfig().then((verified) => {
      if (!verified) {
        logger.error('[Server] ⚠️  Anthropic configuration verification failed - server running but API calls may fail');
      }
    }).catch((error) => {
      logger.error('[Server] ⚠️  Anthropic verification error (non-blocking):', error.message);
    });
  }
  
  // Start keep-alive ping to prevent Railway idle stops
  startKeepAlive();
  
  // Start server - bind to all interfaces for mobile access
  // ✅ Support HTTPS if certs exist (for camera/audio testing)
  // ✅ Enhanced cert detection: supports multiple cert naming patterns
  // ✅ MOBILE FIX: Supports both localhost and LAN IP certificates (mkcert)
  function findCertFiles() {
    const rootDir = path.join(__dirname, '..');
    // ✅ ENHANCED: Support both localhost and LAN IP certificates
    // ✅ SAFE: Additive changes only, preserves existing functionality
    // ✅ PRODUCTION-SAFE: Files won't exist in production (Railway/Vercel use platform SSL)
    const certPatterns = [
      // ✅ NEW: mkcert LAN certificates (for mobile testing on network IPs)
      '192.168.0.10+3.pem',
      '192.168.0.10+2.pem',
      '192.168.0.10+1.pem',
      // ✅ PRESERVED: Existing localhost patterns (backward compatible)
      'localhost+3.pem',
      'localhost+1.pem',
      'localhost.pem'
    ];
    
    const certPath = certPatterns
      .map(pattern => path.join(rootDir, pattern))
      .find(p => fs.existsSync(p));
    
    const certName = certPath ? path.basename(certPath, '.pem') : null;
    const keyPath = certName
      ? path.join(rootDir, `${certName}-key.pem`)
      : null;
    
    return { certPath, keyPath };
  }

  const { certPath, keyPath } = findCertFiles();

  if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    
    const httpsServer = https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
      serverReady = true; // ✅ CRITICAL: Preserve for Railway health checks
      logger.info(`✅ Atlas backend (HTTPS) running on port ${PORT}`);
      logger.info(`   Certificate: ${certPath}`);
      logger.info(`   Healthcheck: https://0.0.0.0:${PORT}/healthz`);
      console.log(`🚀 Server started on port ${PORT}`);
      console.log(`✅ Server is READY - Railway healthcheck should pass now`);
    });
    
    httpsServer.on('error', (err) => {
      logger.error(`❌ HTTPS Server error:`, err);
      console.error(`❌ HTTPS Server error:`, err.message);
      serverReady = false; // ✅ CRITICAL: Preserve for error recovery
    });
    
    // ✅ CRITICAL: Preserve server close handler for Railway monitoring
    httpsServer.on('close', () => {
      logger.warn('⚠️ HTTPS Server closed');
      serverReady = false;
    });
  } else {
    const server = app.listen(PORT, '0.0.0.0', () => {
      serverReady = true; // ✅ CRITICAL: Preserve for Railway health checks
      logger.info(`✅ Atlas backend (HTTP) running on port ${PORT}`);
      logger.info(`   Healthcheck: http://0.0.0.0:${PORT}/healthz`);
      console.log(`🚀 Server started on port ${PORT}`);
      console.log(`✅ Healthcheck available at http://0.0.0.0:${PORT}/healthz`);
      console.log(`✅ Server is READY - Railway healthcheck should pass now`);
    });
    
    // Handle server errors - but don't exit, let Railway handle restart
    server.on('error', (err) => {
      logger.error(`❌ Server error:`, err);
      console.error(`❌ Server error:`, err.message);
      serverReady = false;
      // Don't exit - Railway will handle restart
    });
    
    // Keep process alive - prevent Railway from thinking server crashed
    server.on('close', () => {
      logger.warn('⚠️ Server closed');
      serverReady = false;
    });
  }
}

// Start server with verification
startServer().catch((error) => {
  logger.error('[Server] ❌ Failed to start server:', error);
  process.exit(1);
});
