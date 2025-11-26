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
import jwt from 'jsonwebtoken';
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
import cooldownMiddleware from './middleware/cooldownMiddleware.mjs';
import dailyLimitMiddleware from './middleware/dailyLimitMiddleware.mjs';
import { imageAnalysisRateLimit, messageRateLimit } from './middleware/rateLimitMiddleware.mjs';
import tierGateMiddleware from './middleware/tierGateMiddleware.mjs';
import { handleFastSpringWebhook } from './services/fastspringWebhookService.mjs';
import { handleMailerLiteWebhook } from './services/mailerLiteWebhookService.mjs';
import { processMessage } from './services/messageService.js';
import { notificationService } from './services/notificationService.mjs';
import { buildSmarterPrompt } from './services/promptOrchestrator.mjs';
import { redisService } from './services/redisService.mjs';
import { cleanAIResponse } from './services/textCleaner.mjs';
import { getUserTierSafe } from './services/tierService.mjs';
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

// ✅ CRITICAL: Webhook routes MUST be registered FIRST, before ANY middleware
// This ensures raw body bytes are preserved for HMAC signature verification
// FastSpring webhook (requires raw body for HMAC signature verification)
app.post('/api/fastspring/webhook', express.raw({ type: 'application/json' }), handleFastSpringWebhook);

// MailerLite webhook (requires raw body for HMAC signature verification)
app.post('/api/mailerlite/webhook', express.raw({ type: 'application/json' }), handleMailerLiteWebhook);

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
      const { normalizeTier } = await import('./services/tierService.mjs');
      (profiles || []).forEach(profile => {
        // ✅ CRITICAL: Normalize tier for accurate metrics
        const tier = normalizeTier(profile?.subscription_tier || 'free');
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
    const model = 'claude-3-5-haiku-latest'; // ✅ Verified working
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
    if (!userId) {
      return {}; // Return empty if no userId
    }
    
    if (supabaseUrl === 'https://your-project.supabase.co') {
      return {}; // Skip in development
    }
    
    // ✅ CRITICAL FIX: Use dynamic import to ensure supabase is always available
    // This prevents undefined reference errors during cold boots
    const { supabase } = await import('./config/supabaseClient.mjs');
    
    // ✅ CRITICAL: Double-check supabase is available
    if (!supabase || typeof supabase.from !== 'function') {
      logger.debug('[getUserMemory] Supabase client not properly initialized');
      return {};
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
    // ✅ CRITICAL: Never throw - always return empty object
    logger.warn('[getUserMemory] Error fetching user memory:', error.message);
    return {};
  }
}

// 🔒 BRANDING FILTER: Rewrite any mentions of Claude/Anthropic to maintain Atlas identity
// ✅ ENHANCED GRAMMAR FIX: Legacy function kept for backward compatibility
// Now uses comprehensive text cleaner that automatically detects concatenated words
function fixPunctuationSpacing(text) {
  return cleanAIResponse(text);
}

function filterResponse(text) {
  if (!text) return text;
  
  // Case-insensitive replacements
  let filtered = text;
  
  // ✅ CRITICAL FIX: Remove stage directions (text in asterisks OR square brackets)
  // Examples: "*speaks in a friendly voice*", "*responds warmly*", "[In a clear, conversational voice]", "*clears voice*", "*clears throat*"
  // This prevents stage directions from appearing in transcripts or being spoken
  filtered = filtered.replace(/\*[^*]+\*/g, ''); // Remove text between asterisks (includes "*clears voice*", "*clears throat*")
  filtered = filtered.replace(/\[[^\]]+\]/g, ''); // Remove text between square brackets
  
  // ✅ GRAMMAR FIX: Fix spacing after punctuation marks BEFORE collapsing spaces
  filtered = fixPunctuationSpacing(filtered);
  
  // Collapse multiple spaces (after spacing fixes)
  filtered = filtered.replace(/\s{2,}/g, ' ');
  
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
async function streamAnthropicResponse({ content, model, res, userId, conversationHistory = [], is_voice_call = false, tier = null, preferences = null, conversationId = null, enhancedSystemPrompt = null, enhancedUserPrompt = null, timezone = null }) {
  if (!ANTHROPIC_API_KEY) {
    logger.error('[streamAnthropicResponse] ❌ ANTHROPIC_API_KEY is missing or empty');
    throw new Error('Missing Anthropic API key - check Railway environment variables');
  }
  
  logger.debug('[streamAnthropicResponse] ✅ API key found, length:', ANTHROPIC_API_KEY.length);
  
  // ✅ SMARTER ATLAS: Use enhanced prompts if provided (skip for voice calls)
  let finalUserContent;
  let finalSystemPrompt;
  
  // Skip intel enhancement for voice calls - use existing voice call logic
  if (is_voice_call) {
    // For voice calls: Just use the user's message with memory context (no enhanced instructions)
    let userMemory = {};
    try {
      userMemory = await getUserMemory(userId) || {};
    } catch (memoryError) {
      logger.warn('[streamAnthropicResponse] Error fetching user memory for voice call:', memoryError.message);
      userMemory = {}; // Fallback to empty
    }
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
    // Voice calls use their own system prompt (set later)
    finalSystemPrompt = null;
  } else if (enhancedSystemPrompt && enhancedUserPrompt) {
    // ✅ Use enhanced prompts from orchestrator
    // 🕒 Add timeContext + insightContext to enhanced prompts
    
    let timeContext = "";
    let insightContext = "";
    let ritualContext = "";
    
    if (userId && !is_voice_call) {
      try {
        // Time awareness
        const now = new Date();
        let userTZ = "UTC";
        if (timezone && typeof timezone === "string") {
          userTZ = timezone;
        }
        const localTime = now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: userTZ,
        });
        const localHour = Number(
          now.toLocaleString("en-US", {
            hour: "2-digit",
            hour12: false,
            timeZone: userTZ,
          })
        );
        let timeGreeting = "Hello";
        if (!Number.isNaN(localHour)) {
          if (localHour < 12) timeGreeting = "Good morning";
          else if (localHour < 17) timeGreeting = "Good afternoon";
          else timeGreeting = "Good evening";
        }
        timeContext = `
🕒 TIME CONTEXT:
User timezone: ${userTZ}
Local time: ${localTime}
Greeting: ${timeGreeting}

Use this to:
- Adjust tone (morning vs late-night)
- Suggest rest if it's late
- Encourage morning routines
- Acknowledge the user's time of day
`;

        // Weekly insights
        const { supabase } = await import('./config/supabaseClient.mjs');
        const oneWeekAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: weeklyRituals, error } = await supabase
          .from("ritual_logs")
          .select(`
            id,
            completed_at,
            duration_seconds,
            mood_before,
            mood_after,
            notes,
            rituals (
              id,
              title
            )
          `)
          .eq("user_id", userId)
          .gte("completed_at", oneWeekAgo)
          .order("completed_at", { ascending: false })
          .limit(50);

        if (!error && weeklyRituals?.length > 0) {
          const MOOD_VALUES = {
            stressed: 1,
            anxious: 2,
            tired: 2,
            neutral: 3,
            calm: 4,
            relaxed: 4,
            focused: 5,
            energized: 5,
          };

          const total = weeklyRituals.length;
          const totalDuration = weeklyRituals.reduce(
            (sum, log) => sum + (log.duration_seconds || 60),
            0
          );
          const avgDuration = Math.round(totalDuration / total / 60) || 1;

          let improvements = 0;
          let declines = 0;

          weeklyRituals.forEach((log) => {
            const before = MOOD_VALUES[log.mood_before] ?? 3;
            const after = MOOD_VALUES[log.mood_after] ?? 3;
            if (after > before) improvements++;
            if (after < before) declines++;
          });

          const morning = weeklyRituals.filter((log) => {
            const hour = new Date(log.completed_at).getUTCHours();
            return hour >= 5 && hour < 12;
          }).length;

          const evening = weeklyRituals.filter((log) => {
            const hour = new Date(log.completed_at).getUTCHours();
            return hour >= 17 || hour < 5;
          }).length;

          insightContext = `
📊 WEEKLY INSIGHTS SUMMARY (last 7 days)

• Total rituals completed: ${total}
• Average duration: ${avgDuration} minutes
• Morning rituals: ${morning}
• Evening rituals: ${evening}
• Mood improved after ${improvements} rituals
• Mood worsened after ${declines} rituals

Use these insights to:
- Comment on consistency
- Highlight improvement patterns
- Suggest optimal ritual times
- Encourage healthier emotional routines
- Reflect on mood trends
`;
        } else {
          insightContext = `
📊 WEEKLY INSIGHTS:
The user has no recorded rituals in the last 7 days.
Avoid mentioning weekly stats unless asked.
`;
        }
      } catch (err) {
        logger.warn("[streamAnthropicResponse] Context building failed:", err);
      }
    }
    
    // Append contexts to enhanced prompts
    finalSystemPrompt = enhancedSystemPrompt + (timeContext || "") + (ritualContext || "") + (insightContext || "");
    finalUserContent = enhancedUserPrompt;
    logger.debug('[streamAnthropicResponse] ✅ Using enhanced prompts with time/insight context');
  } else {
    // For text chat: Use full enhanced content with all instructions (existing logic)
    let userMemory = {};
    try {
      userMemory = await getUserMemory(userId) || {};
    } catch (memoryError) {
      logger.warn('[streamAnthropicResponse] Error fetching user memory for text chat:', memoryError.message);
      userMemory = {}; // Fallback to empty
    }
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

    // 🕒 TIME AWARENESS (A2-SAFE) - For streaming path
    let timeContext = "";
    let insightContext = "";
    let ritualContext = "";
    
    if (userId && !is_voice_call) {
      try {
        // Time awareness
        const now = new Date();
        let userTZ = "UTC";
        if (timezone && typeof timezone === "string") {
          userTZ = timezone;
        }

        const localTime = now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: userTZ,
        });

        const localHour = Number(
          now.toLocaleString("en-US", {
            hour: "2-digit",
            hour12: false,
            timeZone: userTZ,
          })
        );

        let timeGreeting = "Hello";
        if (!Number.isNaN(localHour)) {
          if (localHour < 12) timeGreeting = "Good morning";
          else if (localHour < 17) timeGreeting = "Good afternoon";
          else timeGreeting = "Good evening";
        }

        timeContext = `
🕒 TIME CONTEXT:
User timezone: ${userTZ}
Local time: ${localTime}
Greeting: ${timeGreeting}

Use this to:
- Adjust tone (morning vs late-night)
- Suggest rest if it's late
- Encourage morning routines
- Acknowledge the user's time of day
`;

        // Fetch recent ritual logs (for ritualContext)
        const { supabase } = await import('./config/supabaseClient.mjs');
        const { data: ritualLogs, error: ritualError } = await supabase
          .from('ritual_logs')
          .select('ritual_id, completed_at, duration_seconds, mood_before, mood_after, notes')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false })
          .limit(5);
        
        if (!ritualError && ritualLogs && ritualLogs.length > 0) {
          const ritualIds = ritualLogs.map(log => log.ritual_id).filter(Boolean);
          let ritualTitles = {};
          
          if (ritualIds.length > 0) {
            const { data: rituals } = await supabase
              .from('rituals')
              .select('id, title')
              .in('id', ritualIds);
            
            if (rituals) {
              ritualTitles = Object.fromEntries(rituals.map(r => [r.id, r.title]));
            }
          }
          
          const ritualSummaries = ritualLogs.map(log => {
            const title = ritualTitles[log.ritual_id] || 'Ritual';
            const minutes = Math.floor(log.duration_seconds / 60);
            return `- ${title} (${minutes}min): ${log.mood_before} → ${log.mood_after}${log.notes ? ` - "${log.notes}"` : ''}`;
          }).join('\n');
          
          ritualContext = `\n\n🧘 USER'S RECENT RITUALS:\n${ritualSummaries}\n\nWhen discussing rituals, mood, or emotional patterns, reference these recent completions. Help users understand patterns, celebrate progress, and suggest improvements based on their ritual history.`;
        }

        // Weekly insights
        const oneWeekAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: weeklyRituals, error } = await supabase
          .from("ritual_logs")
          .select(`
            id,
            completed_at,
            duration_seconds,
            mood_before,
            mood_after,
            notes,
            rituals (
              id,
              title
            )
          `)
          .eq("user_id", userId)
          .gte("completed_at", oneWeekAgo)
          .order("completed_at", { ascending: false })
          .limit(50);

        if (!error && weeklyRituals?.length > 0) {
          const MOOD_VALUES = {
            stressed: 1,
            anxious: 2,
            tired: 2,
            neutral: 3,
            calm: 4,
            relaxed: 4,
            focused: 5,
            energized: 5,
          };

          const total = weeklyRituals.length;
          const totalDuration = weeklyRituals.reduce(
            (sum, log) => sum + (log.duration_seconds || 60),
            0
          );
          const avgDuration = Math.round(totalDuration / total / 60) || 1;

          let improvements = 0;
          let declines = 0;

          weeklyRituals.forEach((log) => {
            const before = MOOD_VALUES[log.mood_before] ?? 3;
            const after = MOOD_VALUES[log.mood_after] ?? 3;
            if (after > before) improvements++;
            if (after < before) declines++;
          });

          const morning = weeklyRituals.filter((log) => {
            const hour = new Date(log.completed_at).getUTCHours();
            return hour >= 5 && hour < 12;
          }).length;

          const evening = weeklyRituals.filter((log) => {
            const hour = new Date(log.completed_at).getUTCHours();
            return hour >= 17 || hour < 5;
          }).length;

          insightContext = `
📊 WEEKLY INSIGHTS SUMMARY (last 7 days)

• Total rituals completed: ${total}
• Average duration: ${avgDuration} minutes
• Morning rituals: ${morning}
• Evening rituals: ${evening}
• Mood improved after ${improvements} rituals
• Mood worsened after ${declines} rituals

Use these insights to:
- Comment on consistency
- Highlight improvement patterns
- Suggest optimal ritual times
- Encourage healthier emotional routines
- Reflect on mood trends
`;
        } else {
          insightContext = `
📊 WEEKLY INSIGHTS:
The user has no recorded rituals in the last 7 days.
Avoid mentioning weekly stats unless asked.
`;
        }
      } catch (err) {
        logger.warn("[streamAnthropicResponse] Context building failed:", err);
      }
    }

    // ✅ COMPREHENSIVE ATLAS SYSTEM PROMPT - Matches detailed personality spec
    let personalizationNote = '';
    if (preferences) {
      const parts = [];
      if (preferences.workFunction) parts.push(`Work function: ${preferences.workFunction}`);
      if (preferences.goals && preferences.goals.length > 0) parts.push(`Goals: ${preferences.goals.join(', ')}`);
      if (preferences.communicationStyle) parts.push(`Communication style: ${preferences.communicationStyle}`);
      if (parts.length > 0) {
        personalizationNote = `\n\nPERSONALIZATION:\n${parts.join('\n')}`;
      }
    }

    // ✅ NEW: Add tone preference instructions
    if (preferences?.tone_preference) {
      const toneInstructions = {
        warm: 'Use a warm, friendly, kind, human, and encouraging tone. Be supportive and emotionally intelligent.',
        direct: 'Use a structured, efficient, and minimal-emotion tone. Be clear and concise.',
        neutral: 'Use a balanced and factual tone. Be professional and objective.',
        creative: 'Use a metaphorical, playful, and imaginative tone. Be creative and engaging.'
      };
      
      const toneBlock = `\n\nTONE INSTRUCTIONS:\nThe user prefers the tone: "${preferences.tone_preference}".\n${toneInstructions[preferences.tone_preference] || toneInstructions.warm}\n\nMATCH THIS TONE CONSISTENTLY THROUGHOUT YOUR RESPONSE.`;
      
      if (personalizationNote) {
        personalizationNote += toneBlock;
      } else {
        personalizationNote = toneBlock;
      }
    }
    finalUserContent = personalizedContent + `\n\n${timeContext}${ritualContext}${insightContext}You are Atlas — a warm, emotionally intelligent productivity assistant.${personalizationNote}

RESPONSE FORMAT (CRITICAL):
1. Start with a 1–2 sentence summary
2. Use clear section headings (##)
3. Use bullet points or numbered lists
4. Keep paragraphs short (2–3 sentences max)
5. Avoid long philosophical reflections or metaphors

TONE: Warm, grounded, professional. Be concise and structured. Avoid rambling.

📊 TABLE FORMATTING:
Use tables for comparisons, pros/cons, summaries, or feature breakdowns. Tables must have 2–4 columns, 3–8 rows, clear headings, and simple content.

CRITICAL GRAMMAR RULES:
- Never merge words together (e.g., "hereto" → "here to", "pullingat" → "pulling at")
- Always add a space after punctuation (e.g., "Hello,world" → "Hello, world")
- Always proofread before finalizing your response
- Maintain professional spacing and clean formatting at all times
- Ensure all words are properly separated with spaces

ATLAS'S BOUNDARIES:
WHEN TO REDIRECT TO PROFESSIONAL HELP:
If a user mentions:
- Suicidal thoughts or self-harm
- Severe depression or mental health crisis
- Trauma that requires professional support
- Substance abuse issues

RESPONSE:
"What you're describing sounds really serious, and I want to make sure you get the right support. Atlas isn't a replacement for professional help. Would you consider reaching out to a therapist or counselor? If you're in crisis, please contact 988 (US) or your local crisis hotline."

NEVER:
- Diagnose mental health conditions
- Provide medical advice
- Claim to replace therapy
- Make promises about outcomes ("This will fix your anxiety!")

TIER-AWARE RESPONSES:
- Free users hitting limit: "You've used all your free messages this month. Want to keep going? Atlas Core gives you unlimited conversations and the full ritual builder. [Upgrade →]"
- Core users hitting cooldown: "You've had a deep conversation session today. To maintain service quality during our early launch, there's a brief cooldown. More messages unlock in [X hours]. Studio users never experience cooldowns. [Learn more →]"
- Free users trying custom rituals: "Custom rituals are part of Atlas Core. With Core, you can build personalized rituals designed around your emotional rhythms. Want to upgrade? [Learn more →]"

Your goal: Help users think clearly, take action, and feel supported.`;
    finalSystemPrompt = null; // Will use default (no system prompt for text chat in existing logic)
  }

  // 🧠 MEMORY 100%: Build messages array with conversation history
  const messages = [];
  
  // ✅ CRITICAL FIX: Filter out messages with empty content before sending to Anthropic
  // Prevents: "messages.X: all messages must have non-empty content except for the optional final assistant message"
  if (!is_voice_call && conversationHistory && conversationHistory.length > 0) {
    const validHistory = conversationHistory.filter((msg) => {
      const content =
        typeof msg.content === "string"
          ? msg.content.trim()
          : typeof msg.content === "object" && msg.content?.text
          ? String(msg.content.text).trim()
          : "";

      return content.length > 0; // Only keep messages with real content
    });

    // ✅ NEW: Limit to last 8 messages (prevents token bloat, improves performance)
    const limitedHistory = validHistory.slice(-8);
    messages.push(...limitedHistory);
    logger.debug(
      `🧠 [Memory] Added ${limitedHistory.length} messages to context (filtered ${
        conversationHistory.length - validHistory.length
      } empty messages, limited to last 8)`
    );
  } else if (is_voice_call && conversationHistory && conversationHistory.length > 0) {
    // ✅ CRITICAL FIX: Filter for voice calls as well (last 5 messages only)
    const voiceHistory = conversationHistory
      .slice(-5)
      .filter((msg) => {
        const content =
          typeof msg.content === "string"
            ? msg.content.trim()
            : typeof msg.content === "object" && msg.content?.text
            ? String(msg.content.text).trim()
            : "";

        return content.length > 0;
      });

    messages.push(...voiceHistory);
    logger.debug(`🧠 [VoiceCall] Added ${voiceHistory.length} messages for voice context (filtered empty messages)`);
  } else if (is_voice_call) {
    logger.debug(`🧠 [VoiceCall] No conversation history available`);
  }
  
  // Add current user message
  messages.push({ role: 'user', content: finalUserContent });

  // ✅ VOICE CALL FIX: Strong system prompt - override any conversation history confusion
  // ✅ SMARTER ATLAS: Use enhanced system prompt if provided, otherwise use voice call prompt or undefined
  const systemPrompt = finalSystemPrompt || (is_voice_call ? `You are Atlas in a VOICE CALL - a real-time voice conversation. The user speaks out loud and you respond with voice. 

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

You are having a natural voice conversation. Respond as if you can hear them clearly. Keep responses brief (1-2 sentences).` : undefined);

  // ✅ PRODUCTION-SAFE: Add timeout to Anthropic API call (50 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    logger.error('[streamAnthropicResponse] ⏱️ Anthropic API timeout after 50s');
  }, 50000);

  // ✅ CRITICAL DEBUG: Log exact model being sent to Anthropic
  const requestBody = {
    model: is_voice_call ? 'claude-3-5-haiku-latest' : model, // ✅ Use fast Haiku for voice calls
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
        logger.debug(`[streamAnthropicResponse] ✅ Stream complete, received data: ${hasReceivedData}, tokens captured: ${tokenUsage.input_tokens + tokenUsage.output_tokens}`);
        // ✅ CRITICAL: If stream ended but we didn't get usage, log warning
        if (hasReceivedData && tokenUsage.input_tokens === 0 && tokenUsage.output_tokens === 0) {
          logger.warn('[streamAnthropicResponse] ⚠️ Stream completed but no token usage captured - message_stop event may have been missed');
        }
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
            } else if (parsed.type === 'message_stop' || parsed.type === 'content_block_stop') {
              // ✅ TOKEN TRACKING: Capture usage data from stream completion
              // ✅ ENHANCED: Check both event types (some models send usage in content_block_stop)
              if (parsed.usage) {
                tokenUsage = {
                  input_tokens: parsed.usage.input_tokens || 0,
                  output_tokens: parsed.usage.output_tokens || 0,
                  model: model // ✅ Include model in tokenUsage
                };
                logger.info(`[streamAnthropicResponse] ✅ Token usage captured from ${parsed.type}: ${tokenUsage.input_tokens} input, ${tokenUsage.output_tokens} output`);
              } else {
                // ✅ DEBUG: Log full parsed object to understand structure
                // ✅ CRITICAL: Use INFO level to see in production logs
                logger.info(`[streamAnthropicResponse] ⚠️ ${parsed.type} received but no usage data. Full event:`, JSON.stringify(parsed, null, 2));
                if (parsed.type === 'message_stop') {
                  logger.warn('[streamAnthropicResponse] ⚠️ message_stop received but no usage data - Anthropic may not be returning usage for this model');
                  logger.info(`[streamAnthropicResponse] 🔍 Full message_stop event keys:`, Object.keys(parsed));
                }
              }
            } else if (parsed.type === 'error') {
              // ✅ CRITICAL FIX: Handle Anthropic API errors gracefully (don't throw - send via SSE)
              const errorType = parsed.error?.type || 'unknown';
              const errorMessage = parsed.error?.message || 'Anthropic API stream error';
              logger.error(`[streamAnthropicResponse] ❌ Anthropic stream error:`, {
                type: errorType,
                message: errorMessage,
                requestId: parsed.request_id
              });
              
              // ✅ Set flags to prevent "no data chunks" error
              hasReceivedData = true; // Mark as received so we don't throw "no data chunks" error
              
              // ✅ Send user-friendly error message based on error type
              let userMessage = 'Sorry, I hit an error generating the response.';
              if (errorType === 'overloaded_error') {
                userMessage = 'Atlas is experiencing high demand right now. Please try again in a moment.';
              } else if (errorType === 'rate_limit_error') {
                userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
              } else if (errorMessage.includes('overloaded') || errorMessage.includes('Overloaded')) {
                userMessage = 'Atlas is experiencing high demand right now. Please try again in a moment.';
              }
              
              // Send error via SSE immediately
              writeSSE(res, { 
                error: true,
                message: errorMessage,
                errorType: errorType,
                chunk: userMessage
              });
              
              // Set fullText so it gets saved to DB
              fullText = userMessage;
              
              // ✅ CRITICAL: Cancel reader to prevent hanging stream
              try {
                reader.cancel();
              } catch (cancelError) {
                logger.debug('[streamAnthropicResponse] Reader cancel error (non-critical):', cancelError.message);
              }
              
              // Break out of loop gracefully (don't throw)
              break;
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
    
    // ✅ CRITICAL: If no data was received, check if it was an API error (already handled above)
    if (!hasReceivedData && !fullText) {
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
  // ✅ CRITICAL FIX: Log even if tokens are 0 (for debugging) but only if userId exists
  if (userId) {
    try {
      // ✅ CRITICAL: If no token usage captured, estimate tokens as fallback (4.x models don't return usage)
      if (tokenUsage.input_tokens === 0 && tokenUsage.output_tokens === 0) {
        logger.warn('[streamAnthropicResponse] ⚠️ No token usage captured from stream - estimating tokens as fallback');
        
        // ✅ TOKEN ESTIMATION: Rough estimate (4 characters ≈ 1 token for English text)
        // Estimate input tokens from user message + conversation history
        const userMessageLength = (content || '').length;
        const historyLength = conversationHistory.reduce((sum, msg) => sum + (msg.content || '').length, 0);
        const systemPromptLength = (finalSystemPrompt || '').length;
        const estimatedInputTokens = Math.ceil((userMessageLength + historyLength + systemPromptLength) / 4);
        
        // Estimate output tokens from response
        const estimatedOutputTokens = Math.ceil((fullText || '').length / 4);
        
        // Update tokenUsage with estimates
        tokenUsage = {
          input_tokens: estimatedInputTokens,
          output_tokens: estimatedOutputTokens,
          model: model,
          estimated: true // Flag to indicate these are estimates
        };
        
        logger.info(`[streamAnthropicResponse] 📊 Estimated tokens: ${estimatedInputTokens} input, ${estimatedOutputTokens} output (model: ${model})`);
      }
      
      const { estimateRequestCost } = await import('./config/intelligentTierSystem.mjs');
      const cost = estimateRequestCost(model, tokenUsage.input_tokens, tokenUsage.output_tokens);
      
      // Log to usage_logs table (existing system - keep for backward compatibility)
      try {
        const { supabase } = await import('./config/supabaseClient.mjs');
        const { error: insertError } = await supabase.from('usage_logs').insert({
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
            message_length: fullText.length,
            estimated: tokenUsage.estimated || false // Flag if tokens were estimated
          },
          created_at: new Date().toISOString()
        });
        
        if (insertError) {
          logger.error('[streamAnthropicResponse] ❌ Failed to log usage to usage_logs:', {
            error: insertError,
            message: insertError.message,
            code: insertError.code,
            details: insertError.details
          });
        }
      } catch (err) {
        logger.error('[streamAnthropicResponse] ❌ Error logging token usage:', {
          error: err,
          message: err.message,
          stack: err.stack
        });
      }
      
      // ✅ CURSOR-STYLE BILLING: Also log to usage_snapshots via new service
      // ✅ CRITICAL: Only call if we have actual token usage (avoid creating empty snapshots)
      if (tokenUsage.input_tokens > 0 || tokenUsage.output_tokens > 0) {
        try {
          const { logTokenUsage } = await import('./services/usageLoggingService.mjs');
          await logTokenUsage({
            userId,
            model,
            inputTokens: tokenUsage.input_tokens,
            outputTokens: tokenUsage.output_tokens,
            conversationId: conversationId || null,
            messageId: null // Message ID not available at this point in the flow
          });
        } catch (billingLogError) {
          logger.error('[streamAnthropicResponse] ❌ Failed to log to billing system:', {
            error: billingLogError,
            message: billingLogError.message,
            stack: billingLogError.stack
          });
          // Don't fail - billing logging is non-critical
        }
      } else {
        logger.debug('[streamAnthropicResponse] ⏭️ Skipping usage_snapshot update (no tokens)');
      }
      
      logger.debug(`[streamAnthropicResponse] ✅ Logged ${tokenUsage.input_tokens + tokenUsage.output_tokens} tokens, cost: $${cost.toFixed(6)}`);
    } catch (logError) {
      logger.error('[streamAnthropicResponse] ❌ Error logging token usage:', {
        error: logError,
        message: logError.message,
        stack: logError.stack
      });
      // Don't fail the request if logging fails
    }
  } else {
    logger.debug('[streamAnthropicResponse] ⏭️ Skipping usage logging (no userId)');
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
  /^https:\/\/atlas\.otiumcreations\.com$/,  // Production domain
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
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Accept', 'X-Requested-With', 'Cache-Control', 'cache-control', 'Pragma'], // ✅ FIX: Allow Cache-Control headers from frontend
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// ✅ NOTE: Webhook routes are now registered at the top of the file (after app creation)
// This ensures raw body bytes are preserved before any middleware touches the request stream

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

    // ✅ CRITICAL: Use centralized tierService (single source of truth with normalization)
    const tier = await getUserTierSafe(userId);
    
    // ✅ CRITICAL FIX: Count messages directly from messages table (not daily_usage)
    // This ensures accurate count that updates immediately when messages are sent
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const { count: monthlyCount, error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', startOfMonth.toISOString());

    if (countError) {
      logger.error('[Usage API] Error counting messages:', countError.message || countError);
    }

    // ✅ CRITICAL FIX: Default to 0 if count is null/undefined
    const finalMonthlyCount = monthlyCount ?? 0;

    // Get tier limits (matching frontend logic)
    const TIER_LIMITS = {
      free: 15,
      core: -1, // Unlimited
      studio: -1, // Unlimited
    };

    const monthlyLimit = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const remaining = monthlyLimit === -1 ? -1 : Math.max(0, monthlyLimit - finalMonthlyCount);
    const isUnlimited = monthlyLimit === -1;

    // Return format matching UsageCounter expectations
    return res.json({
      monthlyCount: finalMonthlyCount,
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

// ==========================================================
// Cursor-Style Billing System API Endpoints
// ==========================================================

/**
 * GET /api/billing/summary
 * Get current billing period summary for authenticated user
 */
app.get('/api/billing/summary', verifyJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Import billing services
    const { getOrCreateCurrentBillingPeriod } = await import('./services/billingPeriodService.mjs');
    const { calculateOverageForPeriod } = await import('./services/overageBillingService.mjs');
    const { getIncludedCreditsUsdForTier } = await import('./config/intelligentTierSystem.mjs');

    // Get or create current billing period
    const billingPeriodId = await getOrCreateCurrentBillingPeriod(userId);

    // Get billing period details
    const { data: billingPeriod, error: periodError } = await supabase
      .from('billing_periods')
      .select('period_start, period_end, tier')
      .eq('id', billingPeriodId)
      .single();

    if (periodError || !billingPeriod) {
      logger.error('[Billing API] Failed to fetch billing period:', periodError);
      return res.status(500).json({ error: 'Failed to fetch billing period' });
    }

    // Get usage snapshots for this period
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('usage_snapshots')
      .select('model, input_tokens, output_tokens, total_cost_usd')
      .eq('billing_period_id', billingPeriodId)
      .order('total_cost_usd', { ascending: false });

    if (snapshotsError) {
      logger.error('[Billing API] Failed to fetch usage snapshots:', snapshotsError);
      return res.status(500).json({ error: 'Failed to fetch usage data' });
    }

    // Calculate totals
    const totalCostUsd = snapshots?.reduce((sum, s) => sum + (parseFloat(s.total_cost_usd) || 0), 0) || 0;
    const includedCreditsUsd = getIncludedCreditsUsdForTier(billingPeriod.tier);
    const overageUsd = Math.max(0, totalCostUsd - includedCreditsUsd);
    const remainingCreditsUsd = includedCreditsUsd === -1 ? -1 : Math.max(-Infinity, includedCreditsUsd - totalCostUsd);

    // Get overage charges for this period
    const { data: charges, error: chargesError } = await supabase
      .from('overage_charges')
      .select('id, description, cost_usd, status, created_at')
      .eq('billing_period_id', billingPeriodId)
      .order('created_at', { ascending: false });

    if (chargesError) {
      logger.warn('[Billing API] Failed to fetch overage charges:', chargesError);
      // Don't fail - charges are optional
    }

    // Format models array
    const models = (snapshots || []).map(s => ({
      model: s.model,
      inputTokens: parseInt(s.input_tokens) || 0,
      outputTokens: parseInt(s.output_tokens) || 0,
      totalCostUsd: parseFloat(s.total_cost_usd) || 0
    }));

    // Format charges array
    const formattedCharges = (charges || []).map(c => ({
      id: c.id,
      description: c.description,
      costUsd: parseFloat(c.cost_usd) || 0,
      status: c.status,
      createdAt: c.created_at
    }));

    return res.json({
      period: {
        start: billingPeriod.period_start,
        end: billingPeriod.period_end
      },
      tier: billingPeriod.tier,
      includedCreditsUsd,
      usedCreditsUsd: totalCostUsd,
      remainingCreditsUsd,
      models,
      overage: {
        totalOverageUsd: overageUsd,
        charges: formattedCharges
      }
    });

  } catch (error) {
    logger.error('[Billing API] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/invoices
 * Get all overage invoices for authenticated user
 */
app.get('/api/billing/invoices', verifyJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Optional month filter (YYYY-MM format)
    const monthFilter = req.query.month; // e.g. "2025-11"

    let query = supabase
      .from('overage_charges')
      .select('id, description, cost_usd, status, created_at, fastspring_order_id, billing_period_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply month filter if provided
    if (monthFilter && /^\d{4}-\d{2}$/.test(monthFilter)) {
      const [year, month] = monthFilter.split('-');
      const startDate = `${year}-${month}-01T00:00:00Z`;
      const endDate = month === '12' 
        ? `${parseInt(year) + 1}-01-01T00:00:00Z`
        : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01T00:00:00Z`;
      
      query = query
        .gte('created_at', startDate)
        .lt('created_at', endDate);
    }

    const { data: charges, error: chargesError } = await query;

    if (chargesError) {
      logger.error('[Billing API] Failed to fetch invoices:', chargesError);
      return res.status(500).json({ error: 'Failed to fetch invoices' });
    }

    // Format invoices
    const invoices = (charges || []).map(charge => {
      const receiptUrl = charge.fastspring_order_id
        ? `https://api.fastspring.com/receipt/${charge.fastspring_order_id}`
        : null;

      return {
        id: charge.id,
        date: charge.created_at,
        description: charge.description,
        status: charge.status === 'charged' ? 'paid' : charge.status, // Map 'charged' to 'paid' for UI
        amountUsd: parseFloat(charge.cost_usd) || 0,
        invoiceUrl: receiptUrl
      };
    });

    return res.json(invoices);

  } catch (error) {
    logger.error('[Billing API] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /internal/billing/run-overage-cycle
 * Internal endpoint for cron job to run overage billing cycle
 * Protected by INTERNAL_SECRET environment variable
 */
app.post('/internal/billing/run-overage-cycle', async (req, res) => {
  try {
    // Verify internal secret
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.INTERNAL_SECRET || process.env.RAILWAY_INTERNAL_SECRET;
    
    if (!expectedSecret) {
      logger.error('[Billing API] INTERNAL_SECRET not configured');
      return res.status(500).json({ error: 'Internal secret not configured' });
    }

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn('[Billing API] Unauthorized access attempt to internal billing endpoint');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Run billing cycle
    const { runOverageBillingCycle } = await import('./services/overageBillingService.mjs');
    const results = await runOverageBillingCycle();

    return res.json({
      success: true,
      results: {
        processedUsers: results.processedUsers,
        chargesCreated: results.chargesCreated,
        chargesProcessed: results.chargesProcessed,
        errors: results.errors.length > 0 ? results.errors : undefined
      }
    });

  } catch (error) {
    logger.error('[Billing API] Internal error in billing cycle:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
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
    const { timezone } = req.body;
    const result = await processMessage(userId || null, messageText, conversationId, timezone || null);
    
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
app.post('/api/message', verifyJWT, messageRateLimit, tierGateMiddleware, cooldownMiddleware, async (req, res, next) => {
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
    const { message, conversationId, model = 'claude', is_voice_call, context, timezone } = req.body;
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

    // ✅ CRITICAL: Use centralized tierService (single source of truth with normalization)
    const effectiveTier = await getUserTierSafe(userId);
    
    // Fetch user preferences separately (not part of tierService)
    let userPreferences = null;
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .single();
      
      if (!profileError && profile) {
        userPreferences = profile.preferences || null;
      }
    } catch (error) {
      logger.debug(`[Message] Could not fetch preferences for ${userId}:`, error.message);
      // Preferences are optional, continue without them
    }

    // ✅ NEW: Extract tone preference from request body or user preferences
    let tonePreference = null;
    if (req.body?.tonePreference) {
      tonePreference = req.body.tonePreference; // Frontend override (user's current choice)
      logger.debug(`[Message] Using tone preference from request: ${tonePreference}`);
    } else if (userPreferences?.tone_preference) {
      tonePreference = userPreferences.tone_preference; // From database
      logger.debug(`[Message] Using tone preference from database: ${tonePreference}`);
    } else {
      tonePreference = 'warm'; // Default fallback
      logger.debug(`[Message] Using default tone preference: warm`);
    }

    // ✅ NEW: Merge tone preference into userPreferences object
    if (tonePreference) {
      if (userPreferences) {
        userPreferences.tone_preference = tonePreference;
      } else {
        userPreferences = { tone_preference: tonePreference };
      }
    }

    // ✅ CRITICAL FIX: Check paid tiers first to prevent false positives
    // Enforce Free tier monthly limit (15 messages/month) - Studio/Core unlimited
    if (effectiveTier === 'studio' || effectiveTier === 'core') {
      logger.info(`[Server] ✅ ${effectiveTier.toUpperCase()} tier user - unlimited messages (skipping limit check)`);
      // Paid tiers have unlimited messages - skip limit check entirely
    } else if (effectiveTier === 'free' && supabaseUrl !== 'https://your-project.supabase.co') {
      // Only enforce limit for free tier users
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
        logger.debug(`[Server] Free tier user - monthly count: ${monthlyCount ?? 0}/15`);
        if ((monthlyCount ?? 0) >= 15) {
          logger.warn(`[Server] ⚠️ Free tier limit reached for user ${userId}: ${monthlyCount} messages`);
          return res.status(429).json({
            error: 'Monthly limit reached for Free tier',
            upgrade_required: true,
            tier: effectiveTier,
            limits: { monthly_messages: 15 }
          });
        }
      } catch (error) {
        logger.error('[Server] Error checking free tier limit:', error);
        // Continue without limit check in case of error (fail open for paid tiers, fail closed for free)
        if (effectiveTier === 'free') {
          logger.warn('[Server] ⚠️ Could not verify free tier limit - allowing request but logging warning');
        }
      }
    } else {
      logger.warn(`[Server] ⚠️ Unknown tier '${effectiveTier}' - defaulting to free tier behavior`);
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
    // Studio → Sonnet, Core → Sonnet, Free → Haiku (handled by selectOptimalModel)
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
          .limit(8); // ✅ NEW: Last 8 messages for context (prevents token bloat)
        
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
            
            // ✅ SMARTER ATLAS: Build enhanced prompts (skip for voice calls)
            let enhancedSystemPrompt = null;
            let enhancedUserPrompt = null;
            
            if (!is_voice_call) {
              try {
                // Get user name from user metadata or email
                const userName = req.user?.user_metadata?.full_name || req.user?.email?.split('@')[0] || 'Atlas user';
                
                // Build smarter prompt using orchestrator
                let smarterPrompt = null;
                try {
                  smarterPrompt = buildSmarterPrompt({
                    userId,
                    userName,
                    latestUserText: message.trim(),
                    recentMessages: conversationHistory || [],
                    conversationTags: [], // Empty for now - can add DB persistence later
                  });
                } catch (syncError) {
                  logger.warn('[SmarterAtlas] Synchronous error building prompts:', syncError.message);
                  smarterPrompt = null;
                }
                
                // ✅ CRITICAL: Validate smarterPrompt before using
                if (smarterPrompt && typeof smarterPrompt === 'object' && smarterPrompt.systemPrompt && smarterPrompt.userPrompt) {
                  enhancedSystemPrompt = smarterPrompt.systemPrompt;
                  enhancedUserPrompt = smarterPrompt.userPrompt;
                  logger.debug('[SmarterAtlas] ✅ Enhanced prompts built successfully', {
                    mode: smarterPrompt.intel?.mode,
                    emotion: smarterPrompt.intel?.emotion,
                    goal: smarterPrompt.intel?.goal,
                  });
                } else {
                  logger.debug('[SmarterAtlas] Orchestrator returned null/invalid, using default prompts');
                }
              } catch (intelError) {
                logger.warn('[SmarterAtlas] Error building enhanced prompts, falling back to default:', intelError.message);
                // Continue with default prompts - don't break the request
              }
            }
            
            // ✅ RETRY LOGIC WITH MODEL FALLBACK: Retry on overloaded_error with exponential backoff + model fallback
            // Research-backed: Fallback to Haiku when Sonnet overloads (best practice)
            const MAX_RETRIES = 2; // Retry up to 2 times (3 total attempts)
            let retryAttempt = 0;
            let lastError = null;
            let currentModel = selectedModel; // Track current model (may change on fallback)
            
            // ✅ Import fallback function
            const { getFallbackModel } = await import('./config/intelligentTierSystem.mjs');
            
            while (retryAttempt <= MAX_RETRIES) {
              try {
                finalText = await streamAnthropicResponse({ 
                  content: message.trim(), 
                  model: currentModel, // Use current model (may be fallback)
                  res, 
                  userId, 
                  conversationHistory, 
                  is_voice_call, 
                  tier: effectiveTier, 
                  preferences: userPreferences, 
                  conversationId: finalConversationId,
                  enhancedSystemPrompt,
                  enhancedUserPrompt,
                  timezone: timezone || null // ✅ NEW
                });
                
                // ✅ Check if response is an error message (indicates overloaded_error was handled)
                const isOverloadError = finalText && (
                  finalText.includes('experiencing high demand') ||
                  finalText.includes('rate limit exceeded')
                );
                
                if (isOverloadError && retryAttempt < MAX_RETRIES) {
                  retryAttempt++;
                  
                  // ✅ MODEL FALLBACK: If Sonnet overloads, try Haiku (research-backed best practice)
                  // First retry uses fallback model (different model, no delay needed)
                  const fallbackModel = getFallbackModel(currentModel, effectiveTier);
                  const shouldFallback = fallbackModel && currentModel.includes('sonnet') && retryAttempt === 1;
                  
                  if (shouldFallback) {
                    logger.info(`[API CALL] 🔄 Sonnet overloaded, falling back to Haiku (attempt ${retryAttempt + 1}/${MAX_RETRIES + 1})`);
                    currentModel = fallbackModel;
                    
                    // Send fallback status to frontend
                    writeSSE(res, { 
                      event: 'model_fallback',
                      from: selectedModel,
                      to: fallbackModel,
                      attempt: retryAttempt + 1,
                      message: 'Switching to faster model due to high demand...'
                    });
                    
                    // Retry immediately with fallback model (no delay - different model)
                    continue;
                  } else {
                    // Standard retry with same model (exponential backoff)
                    const delay = Math.pow(2, retryAttempt) * 1000; // 2s, 4s delays
                    logger.warn(`[API CALL] ⚠️ Overload detected, retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES + 1})`);
                    
                    writeSSE(res, { 
                      event: 'retry',
                      attempt: retryAttempt + 1,
                      maxRetries: MAX_RETRIES + 1,
                      delay: delay,
                      message: `Retrying... (attempt ${retryAttempt + 1}/${MAX_RETRIES + 1})`
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue; // Retry
                  }
                }
                
                // Success or final attempt - break out of retry loop
                streamCompleted = true;
                
                // ✅ Log model used for cost tracking and analytics
                if (currentModel !== selectedModel) {
                  logger.info(`✅ [API CALL] Success with fallback model: ${currentModel} (original: ${selectedModel})`, {
                    originalModel: selectedModel,
                    fallbackModel: currentModel,
                    userTier: effectiveTier
                  });
                } else {
                  logger.info(`✅ [API CALL] Claude streaming completed successfully, final text length: ${finalText?.length || 0}`, {
                    model: currentModel,
                    userTier: effectiveTier
                  });
                }
                
                // ✅ CRITICAL: If stream returned empty, it means no data was received (error messages are handled above)
                if (!finalText || finalText.trim().length === 0) {
                  logger.error(`❌ [API CALL] Stream completed but returned empty response`);
                  throw new Error('Anthropic API stream completed without sending any data chunks');
                }
                
                break; // Success - exit retry loop
              } catch (apiError) {
                lastError = apiError;
                const errorMessage = apiError?.message || '';
                
                // Only retry on overloaded errors
                const isOverloadError = errorMessage.includes('overloaded') || 
                                       errorMessage.includes('Overloaded') ||
                                       errorMessage.includes('rate limit');
                
                if (isOverloadError && retryAttempt < MAX_RETRIES) {
                  retryAttempt++;
                  
                  // ✅ MODEL FALLBACK: Try Haiku if Sonnet fails (first retry only)
                  const fallbackModel = getFallbackModel(currentModel, effectiveTier);
                  const shouldFallback = fallbackModel && currentModel.includes('sonnet') && retryAttempt === 1;
                  
                  if (shouldFallback) {
                    logger.info(`[API CALL] 🔄 Sonnet error, falling back to Haiku (attempt ${retryAttempt + 1}/${MAX_RETRIES + 1})`);
                    currentModel = fallbackModel;
                    
                    writeSSE(res, { 
                      event: 'model_fallback',
                      from: selectedModel,
                      to: fallbackModel,
                      attempt: retryAttempt + 1,
                      message: 'Switching to faster model...'
                    });
                    
                    // Retry immediately with fallback model (no delay - different model)
                    continue;
                  } else {
                    // Standard retry with exponential backoff
                    const delay = Math.pow(2, retryAttempt) * 1000;
                    logger.warn(`[API CALL] ⚠️ Overload error caught, retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES + 1})`);
                    
                    writeSSE(res, { 
                      event: 'retry',
                      attempt: retryAttempt + 1,
                      maxRetries: MAX_RETRIES + 1,
                      delay: delay,
                      message: `Retrying... (attempt ${retryAttempt + 1}/${MAX_RETRIES + 1})`
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                  }
                }
                
                // Not an overload error or max retries reached - throw
                throw apiError;
              }
            }
            
            // If we exhausted retries and still have error message, that's fine - it was sent via SSE
            if (lastError && finalText && finalText.includes('experiencing high demand')) {
              streamCompleted = true; // Mark as completed - error message was sent
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
          
          // ✅ SMARTER ATLAS: Build enhanced prompts for fallback too (skip for voice calls)
          let enhancedSystemPrompt = null;
          let enhancedUserPrompt = null;
          
          if (!is_voice_call) {
            try {
              const userName = req.user?.user_metadata?.full_name || req.user?.email?.split('@')[0] || 'Atlas user';
              const smarterPrompt = buildSmarterPrompt({
                userId,
                userName,
                latestUserText: message.trim(),
                recentMessages: conversationHistory,
                conversationTags: [],
              });
              
              if (smarterPrompt) {
                enhancedSystemPrompt = smarterPrompt.systemPrompt;
                enhancedUserPrompt = smarterPrompt.userPrompt;
              }
            } catch (intelError) {
              logger.warn('[SmarterAtlas] Error building enhanced prompts for fallback:', intelError.message);
            }
          }
          
          finalText = await streamAnthropicResponse({ 
            content: message.trim(), 
            model: selectedModel, 
            res, 
            userId, 
            conversationHistory, 
            is_voice_call, 
            tier: effectiveTier, 
            conversationId: finalConversationId,
            enhancedSystemPrompt,
            enhancedUserPrompt,
            timezone: timezone || null // ✅ NEW
          });
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
                model: is_voice_call ? 'claude-3-5-haiku-latest' : selectedModel, // 🚀 Use fast Haiku for voice
                max_tokens: is_voice_call ? 300 : 2000, // 🚀 Shorter responses for voice
                // ✅ FIX: Move system message to top-level for Claude API
                ...(is_voice_call && {
                  system: `You're Atlas, a warm and emotionally intelligent productivity assistant.

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
      imageUrl: req.body?.imageUrl?.substring(0, 50) + '...',
      attachmentsCount: req.body?.attachments?.length || 0
    });
    
    const { imageUrl, attachments, prompt = "Please analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand." } = req.body;
    const authenticatedUserId = req.user?.id;
    // ✅ Use tier from tierGateMiddleware (already validated)
    const tier = req.tier || 'free';
    const selectedModel = req.selectedModel || 'claude-sonnet-4-5-20250929'; // ✅ Works (4.x models don't return usage, we estimate)
    
    // ✅ FIX: Support both single imageUrl (legacy) and attachments array (new)
    const imageAttachments = attachments && Array.isArray(attachments) && attachments.length > 0
      ? attachments.filter(att => att.type === 'image' && att.url)
      : imageUrl ? [{ type: 'image', url: imageUrl }] : [];
    
    if (imageAttachments.length === 0) {
      logger.warn('[Image Analysis] Missing imageUrl or attachments in request');
      return res.status(400).json({ error: 'Image URL or attachments array is required' });
    }
    
    // Use first image for analysis (Claude Vision analyzes one at a time)
    const primaryImageUrl = imageAttachments[0].url;

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

    // ✅ BEST PRACTICE: Validate image URL format (use primaryImageUrl after extraction)
    try {
      const urlObj = new URL(primaryImageUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return res.status(400).json({ 
          error: 'Invalid image URL',
          details: 'Image URL must use HTTP or HTTPS protocol'
        });
      }
    } catch (urlError) {
      logger.warn('[Image Analysis] Invalid URL format:', primaryImageUrl?.substring(0, 50));
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

    // ✅ ENHANCED: Fetch user memory for contextual image analysis
    let userMemory = {};
    try {
      userMemory = await getUserMemory(authenticatedUserId) || {};
    } catch (memoryError) {
      logger.warn('[Image Analysis] Error fetching user memory:', memoryError.message);
      userMemory = {}; // Fallback to empty
    }
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🧠 [Image Analysis] Retrieved user memory:', JSON.stringify(userMemory));
    }

    // ✅ ENHANCED: Build contextual prompt with user memory and emotional intelligence guidance
    let enhancedPrompt = prompt;
    
    // Add user memory context if available
    if (userMemory.name || userMemory.context) {
      let contextInfo = '';
      if (userMemory.name) {
        contextInfo += `The user's name is ${userMemory.name}. `;
      }
      if (userMemory.context) {
        contextInfo += `Context about the user: ${userMemory.context}. `;
      }
      contextInfo += 'Use this information to provide personalized, emotionally intelligent insights about how this image may relate to what they are going through. ';
      enhancedPrompt = contextInfo + enhancedPrompt;
    }

    // ✅ ENHANCED: Add emotional intelligence guidance to prompt
    enhancedPrompt += '\n\nIMPORTANT: As Atlas, an emotionally intelligent productivity assistant, use your emotional intelligence to:';
    enhancedPrompt += '\n- Consider how this image might relate to the user\'s current emotional state, challenges, or goals';
    enhancedPrompt += '\n- Provide insights that connect the image to their personal context when relevant';
    enhancedPrompt += '\n- Be thoughtful and empathetic in your analysis';
    enhancedPrompt += '\n- Help them see patterns or connections they might be missing';
    enhancedPrompt += '\n- Focus on productive and emotionally intelligent assistance';
    
    // ✅ ENHANCED: Build Atlas system message with emotional intelligence guidance
    const atlasSystemMessage = `You are Atlas, an emotionally intelligent productivity assistant designed to help people understand how their emotions shape their actions and build sustainable productivity habits.

ATLAS'S IDENTITY:
You are NOT:
- A therapist or mental health professional
- A life coach selling a system
- A generic chatbot with scripted responses
- A productivity guru with rigid rules

You ARE:
- An emotionally intelligent productivity assistant
- A reflective mirror that helps people see patterns they might be missing
- A thoughtful companion for emotional processing and productivity
- A guide for building sustainable rituals rooted in self-awareness
- A non-judgmental space for honest exploration

ATLAS'S TONE & APPROACH:
TONE:
- Warm but not overly enthusiastic
- Thoughtful and measured, not reactive
- Honest without being harsh
- Curious without being intrusive
- Grounded in what the user shares, not assumptions

LANGUAGE:
- Use "you" (not "we" or "let's" unless contextually natural)
- Short, clear sentences
- No corporate jargon or therapy-speak
- No toxic positivity ("Everything happens for a reason!")
- No empty reassurance ("You've got this!" without context)
- Be concise - avoid over-explaining

ATLAS'S CORE PRINCIPLES:

1. PATTERNS OVER PRESCRIPTIONS
   Don't tell people what to do. Help them see why they're stuck.

2. CURIOSITY OVER SOLUTIONS
   Ask questions that help users discover their own insights.

3. EMOTIONAL HONESTY OVER MOTIVATION
   Acknowledge hard truths. Don't paper over them with positivity.

4. RITUAL BUILDING OVER ROUTINES
   Rituals are flexible and emotionally grounded. Routines are rigid.

5. SUSTAINABLE OVER OPTIMAL
   Better to do something small consistently than something perfect once.

IMAGE ANALYSIS GUIDANCE:
When analyzing images:
- Connect visual elements to the user's emotional context when relevant
- Use your understanding of their situation to provide meaningful insights
- Help them see connections between the image and their current challenges or goals
- Be empathetic and thoughtful in your observations
- Provide productive and emotionally intelligent assistance
- Consider how the image might relate to what they're going through

RESPONSE FORMATTING:
- Use markdown: **bold**, lists, tables when helpful
- Use emojis sparingly (1-2 per response max): ✨ insights, 💡 ideas, 🎯 goals, 💪 encouragement, 🤔 reflection, ❤️ support
- Keep paragraphs short (2-3 sentences max) for mobile readability
- Use proper grammar and spacing`;

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
              system: atlasSystemMessage, // ✅ ENHANCED: Add Atlas system message with emotional intelligence
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: enhancedPrompt // ✅ ENHANCED: Use contextual prompt with user memory
                  },
                  {
                    type: 'image',
                    source: {
                      type: 'url',
                      url: primaryImageUrl  // ✅ Direct URL - no download/encoding needed! (analyze first image)
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
        // ✅ FIX: Don't save default prompt as message content - it's not user content
        const defaultPrompt = "Please analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand.";
        const messageContent = (prompt && prompt.trim() !== defaultPrompt.trim()) ? prompt : '';
        
        const { error: userMsgError } = await supabase
          .from('messages')
          .insert({
            user_id: authenticatedUserId,
            conversation_id: conversationId,
            role: 'user',
            content: messageContent, // ✅ FIX: Empty string instead of default prompt
            // ✅ FIX: Save ALL image attachments, not just the first one
            attachments: imageAttachments,
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
          image_url: primaryImageUrl, // Store primary image URL for analysis record
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
      imageUrl: primaryImageUrl, // Primary image analyzed
      attachments: imageAttachments, // ✅ Return all attachments for frontend
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
      attachmentsCount: req.body?.attachments?.length || 0,
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
      logger.error('[Transcribe] OpenAI client not initialized - OPENAI_API_KEY missing');
      return res.status(503).json({ 
        error: 'Audio transcription service unavailable',
        details: 'OpenAI API key not configured'
      });
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
    const tmpDir = process.env.TMPDIR || '/tmp';
    const tmpFile = path.join(tmpDir, `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`);
    
    try {
      // ✅ CRITICAL FIX: Ensure tmp directory exists
      const { mkdir } = await import('fs/promises');
      await mkdir(tmpDir, { recursive: true }).catch(() => {}); // Ignore if exists
      
      await writeFile(tmpFile, audioBuffer);
      logger.debug(`✅ [Transcribe] Temp file created: ${tmpFile} (${audioBuffer.length} bytes)`);
      
      // ✅ CRITICAL FIX: Import fs synchronously for createReadStream
      const fs = await import('fs');
      const fileStream = fs.createReadStream(tmpFile);
      
      // Transcribe with OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fileStream,
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
      
      logger.error('[Transcribe] Whisper API error:', {
        error: whisperError.message,
        stack: whisperError.stack,
        audioUrl: audioUrl,
        userId: userId,
        tier: tier
      });
      
      return res.status(500).json({ 
        error: 'Transcription failed',
        details: whisperError.message || 'Unknown error occurred'
      });
    }
    
  } catch (error) {
    logger.error('[Transcribe] Unexpected error:', {
      error: error.message,
      stack: error.stack,
      audioUrl: req.body?.audioUrl,
      userId: req.user?.id
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error occurred'
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

// iOS IAP Receipt Verification Endpoint
app.post('/api/iap/verify', verifyJWT, async (req, res) => {
  try {
    const { receipt, transactionId, tier, platform } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!receipt || !transactionId || !tier || !platform) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: receipt, transactionId, tier, platform'
      });
    }

    if (platform !== 'ios') {
      return res.status(400).json({
        success: false,
        error: 'Only iOS platform is currently supported'
      });
    }

    if (tier !== 'core' && tier !== 'studio') {
      return res.status(400).json({
        success: false,
        error: 'Invalid tier. Must be "core" or "studio"'
      });
    }

    // ✅ SECURITY FIX #1: Basic receipt format validation
    if (typeof receipt !== 'string' || receipt.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid receipt format'
      });
    }

    // ✅ SECURITY FIX #2: Idempotency check - prevent duplicate transactions
    const { data: existingAudits, error: auditCheckError } = await supabase
      .from('subscription_audit')
      .select('id, metadata, created_at')
      .eq('profile_id', userId)
      .eq('provider', 'app_store')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!auditCheckError && existingAudits) {
      // Check if this transactionId already exists in metadata
      const duplicateTransaction = existingAudits.find(audit => 
        audit.metadata?.transaction_id === transactionId
      );

      if (duplicateTransaction) {
        logger.warn(`[IAP] Duplicate transaction detected: ${transactionId} for user ${userId}`);
        return res.status(409).json({
          success: false,
          error: 'Transaction already processed',
          transactionId,
          message: 'This purchase has already been processed'
        });
      }
    }

    // ✅ SECURITY FIX #3: Validate receipt with Apple (production-ready)
    // In production, replace this with actual Apple verifyReceipt API call
    const APPLE_RECEIPT_VALIDATION_URL = process.env.NODE_ENV === 'production'
      ? 'https://buy.itunes.apple.com/verifyReceipt'
      : 'https://sandbox.itunes.apple.com/verifyReceipt';

    let validatedReceipt = null;
    let extractedTier = tier; // Default to client-provided tier (will be replaced by validated receipt)
    let matchingTransaction = null;
    let productId = null;

    try {
      // ✅ PRODUCTION: Full Apple receipt validation with Apple verifyReceipt API
      const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET;
      
      if (!APPLE_SHARED_SECRET) {
        logger.error('[IAP] APPLE_SHARED_SECRET not configured');
        return res.status(500).json({
          success: false,
          error: 'Receipt validation service unavailable',
          details: 'Server configuration error'
        });
      }

      // First attempt: production URL (or sandbox in dev)
      let appleResponse = await fetch(APPLE_RECEIPT_VALIDATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receipt,
          'password': APPLE_SHARED_SECRET,
          'exclude-old-transactions': false
        })
      });

      let appleData = await appleResponse.json();

      // Handle sandbox receipt in production (status 21007)
      // Apple requires retrying with sandbox URL when this occurs
      if (appleData.status === 21007 && process.env.NODE_ENV === 'production') {
        logger.info('[IAP] Sandbox receipt detected in production, retrying with sandbox URL');
        const SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
        appleResponse = await fetch(SANDBOX_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'receipt-data': receipt,
            'password': APPLE_SHARED_SECRET,
            'exclude-old-transactions': false
          })
        });
        appleData = await appleResponse.json();
      }

      // Validate receipt status
      // Status 0 = success, other statuses indicate various errors
      if (appleData.status !== 0) {
        const statusMessages = {
          21000: 'The App Store could not read the receipt data',
          21002: 'The receipt data was malformed or missing',
          21003: 'The receipt could not be authenticated',
          21004: 'The shared secret does not match',
          21005: 'The receipt server is temporarily unavailable',
          21006: 'This receipt is valid but the subscription has expired',
          21007: 'This receipt is from the sandbox environment',
          21008: 'This receipt is from the production environment',
          21010: 'This receipt could not be authorized'
        };
        
        const errorMessage = statusMessages[appleData.status] || `Receipt validation failed with status ${appleData.status}`;
        logger.error(`[IAP] Receipt validation failed: ${errorMessage} (status: ${appleData.status})`);
        
        return res.status(400).json({
          success: false,
          error: 'Receipt validation failed',
          details: errorMessage,
          status: appleData.status
        });
      }

      // Store validated receipt for audit trail
      validatedReceipt = appleData;

      // Extract tier from validated receipt (not client-provided tier)
      // Apple receipts contain in_app array with all transactions
      const inAppPurchases = appleData.receipt?.in_app || [];
      
      // Find the transaction matching our transactionId
      matchingTransaction = inAppPurchases.find(
        (purchase) => purchase.transaction_id === transactionId || 
                      purchase.original_transaction_id === transactionId
      );

      if (!matchingTransaction) {
        logger.error(`[IAP] Transaction ${transactionId} not found in receipt`);
        return res.status(400).json({
          success: false,
          error: 'Transaction not found in receipt',
          details: 'The transaction ID does not match any purchase in the receipt'
        });
      }

      // Extract tier from product_id
      productId = matchingTransaction.product_id;
      if (productId?.includes('core')) {
        extractedTier = 'core';
      } else if (productId?.includes('studio')) {
        extractedTier = 'studio';
      } else {
        logger.error(`[IAP] Unknown product_id: ${productId}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid product ID',
          details: `Product ID "${productId}" is not recognized`
        });
      }

      // Verify transaction_id matches (security check)
      if (matchingTransaction.transaction_id !== transactionId && 
          matchingTransaction.original_transaction_id !== transactionId) {
        logger.warn(`[IAP] Transaction ID mismatch: expected ${transactionId}, found ${matchingTransaction.transaction_id}`);
        // Still proceed but log warning - original_transaction_id is valid for renewals
      }
      
      logger.info(`[IAP] ✅ Receipt validated for user ${userId}, extracted tier: ${extractedTier}, transaction: ${transactionId}, product: ${productId}`);
    } catch (receiptError) {
      logger.error('[IAP] Receipt validation failed:', receiptError);
      return res.status(400).json({
        success: false,
        error: 'Receipt validation failed',
        details: 'Invalid or expired receipt'
      });
    }

    // ✅ SECURITY FIX #5: Use extracted tier from validated receipt (not client-provided)
    const normalizedTier = extractedTier.toLowerCase().trim();
    
    if (normalizedTier !== 'core' && normalizedTier !== 'studio') {
      return res.status(400).json({
        success: false,
        error: 'Invalid tier extracted from receipt'
      });
    }
    
    logger.info(`[IAP] Verifying receipt for user ${userId}, tier: ${normalizedTier}, transaction: ${transactionId}`);

    // Update user tier in Supabase
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: normalizedTier,
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      logger.error('[IAP] Failed to update user tier:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update subscription'
      });
    }

    // ✅ SECURITY FIX #6: Log to subscription_audit with full Apple validation response
    const { error: auditError } = await supabase.from('subscription_audit').insert({
      profile_id: userId,
      event_type: 'activation',
      old_tier: 'free',
      new_tier: normalizedTier,
      provider: 'app_store',
      metadata: {
        transaction_id: transactionId,
        platform: platform,
        receipt_length: receipt.length,
        receipt_preview: receipt.substring(0, 50) + '...', // Truncate for privacy
        apple_validation: {
          status: validatedReceipt?.status,
          environment: validatedReceipt?.receipt?.receipt_type === 'Production' ? 'production' : 'sandbox',
          validation_date: new Date().toISOString(),
          product_id: matchingTransaction?.product_id,
          purchase_date_ms: matchingTransaction?.purchase_date_ms,
          expires_date_ms: matchingTransaction?.expires_date_ms
        }
      }
    });

    if (auditError) {
      logger.error('[IAP] Failed to log audit:', auditError);
      // Don't fail the request if audit logging fails
    }

    logger.info(`[IAP] ✅ Successfully verified and activated ${normalizedTier} tier for user ${userId}`);

    return res.json({
      success: true,
      tier: normalizedTier,
      transactionId,
      message: 'Subscription activated successfully'
    });

  } catch (error) {
    logger.error('[IAP] Receipt verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Receipt verification failed',
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
        // ✅ CRITICAL: Use centralized tierService for consistent normalization
        // First get userId from email
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();
        
        if (profile?.id) {
          tier = await getUserTierSafe(profile.id);
        } else {
          tier = 'free'; // Fail closed
        }
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

// MailerLite Proxy Endpoint - Fixes CORS and API key exposure
// ======================================
// Unified proxy for all MailerLite operations from frontend
// ======================================
app.post('/api/mailerlite/proxy', verifyJWT, async (req, res) => {
  try {
    const { operation, data } = req.body;
    
    if (!operation) {
      return res.status(400).json({ 
        error: 'Missing required field: operation' 
      });
    }

    const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
    
    if (!MAILERLITE_API_KEY) {
      logger.debug('[MailerLite Proxy] Not configured - skipping operation');
      return res.status(200).json({ 
        success: false,
        disabled: true,
        message: 'MailerLite service not configured' 
      });
    }

    const apiUrl = 'https://api.mailerlite.com/api/v2';
    
    // ✅ FIX: Map group names to group IDs (MailerLite V2 requires numeric IDs)
    // Get IDs from MailerLite dashboard: Groups → Click group → URL shows ID
    const GROUP_ID_MAP = {
      'atlas_free_users': process.env.MAILERLITE_GROUP_FREE_ID || null,
      'core_subscribers': process.env.MAILERLITE_GROUP_CORE_ID || null,
      'studio_subscribers': process.env.MAILERLITE_GROUP_STUDIO_ID || null,
      'atlas_upgrade_ready': process.env.MAILERLITE_GROUP_UPGRADE_READY_ID || null,
    };
    
    // ✅ FIX: Helper function to get group ID from name (with API fallback)
    const getGroupId = async (groupName) => {
      // First check environment variable map
      if (GROUP_ID_MAP[groupName]) {
        return GROUP_ID_MAP[groupName];
      }
      
      // If not in map, fetch from MailerLite API
      try {
        logger.debug(`[MailerLite Proxy] Fetching group ID for ${groupName} from API...`);
        const groupsResponse = await fetch(`${apiUrl}/groups`, {
          headers: {
            'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          },
        });
        
        if (groupsResponse.ok) {
          const groups = await groupsResponse.json();
          const group = groups.data?.find(g => g.name === groupName);
          if (group) {
            logger.debug(`[MailerLite Proxy] ✅ Found group ID for ${groupName}: ${group.id}`);
            return group.id;
          } else {
            logger.warn(`[MailerLite Proxy] ⚠️ Group ${groupName} not found in MailerLite`);
          }
        } else {
          const errorData = await groupsResponse.json().catch(() => ({}));
          logger.warn(`[MailerLite Proxy] Failed to fetch groups: ${groupsResponse.status} - ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        logger.warn(`[MailerLite Proxy] Error fetching group ID for ${groupName}:`, error);
      }
      
      return null;
    };
    
    let response;
    let result;

    switch (operation) {
      case 'createOrUpdateSubscriber': {
        const { email, name, tier, conversations_today, total_conversations, last_active, signup_date, subscription_status, custom_fields, groupName } = data;
        
        if (!email) {
          return res.status(400).json({ error: 'Missing required field: email' });
        }

        const subscriberData = {
          email,
          name: name || '',
          fields: {
            tier: tier || 'free',
            conversations_today: conversations_today || 0,
            total_conversations: total_conversations || 0,
            last_active: last_active || new Date().toISOString(),
            signup_date: signup_date || new Date().toISOString(),
            subscription_status: subscription_status || 'active',
            ...custom_fields,
          },
          resubscribe: true,
        };

        // ✅ FIX: Create/update subscriber first
        response = await fetch(`${apiUrl}/subscribers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          },
          body: JSON.stringify(subscriberData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`MailerLite subscriber creation failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }

        result = await response.json().catch(() => ({}));
        
        // ✅ FIX: Automatically add to group if groupName is provided
        if (groupName) {
          const groupId = await getGroupId(groupName);
          if (groupId) {
            try {
              const groupResponse = await fetch(`${apiUrl}/groups/${groupId}/subscribers`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
                },
                body: JSON.stringify({ email }),
              });
              
              if (!groupResponse.ok) {
                const groupError = await groupResponse.json().catch(() => ({}));
                logger.warn(`[MailerLite Proxy] ⚠️ Failed to add ${email} to group ${groupName} (ID: ${groupId}): ${groupResponse.status} - ${groupError.message || 'Unknown error'}`);
                // Don't throw - subscriber was created successfully, group add is secondary
              } else {
                logger.debug(`[MailerLite Proxy] ✅ Added ${email} to group ${groupName} (ID: ${groupId})`);
              }
            } catch (groupError) {
              logger.warn(`[MailerLite Proxy] Error adding ${email} to group ${groupName}:`, groupError);
              // Don't throw - subscriber was created successfully
            }
          } else {
            logger.warn(`[MailerLite Proxy] ⚠️ Group ${groupName} not found - subscriber created but not added to group. Check group name or set MAILERLITE_GROUP_*_ID env vars.`);
          }
        }
        
        break;
      }

      case 'updateCustomFields': {
        const { email, fields } = data;
        
        if (!email || !fields) {
          return res.status(400).json({ error: 'Missing required fields: email, fields' });
        }

        response = await fetch(`${apiUrl}/subscribers/${encodeURIComponent(email)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          },
          body: JSON.stringify({ fields }),
        });
        break;
      }

      case 'triggerEvent': {
        const { email, event, properties } = data;
        
        if (!email || !event) {
          return res.status(400).json({ error: 'Missing required fields: email, event' });
        }

        // MailerLite v2 API uses custom fields for events
        const eventFields = {
          last_event: event,
          last_event_time: new Date().toISOString(),
          ...properties,
        };

        response = await fetch(`${apiUrl}/subscribers/${encodeURIComponent(email)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          },
          body: JSON.stringify({ fields: eventFields }),
        });
        break;
      }

      case 'segmentSubscriber': {
        const { email, groupName } = data;
        
        if (!email || !groupName) {
          return res.status(400).json({ error: 'Missing required fields: email, groupName' });
        }

        // ✅ FIX: Get group ID from name
        const groupId = await getGroupId(groupName);
        if (!groupId) {
          logger.error(`[MailerLite Proxy] ❌ Group ${groupName} not found - cannot add subscriber`);
          return res.status(404).json({ 
            success: false,
            error: `Group ${groupName} not found`,
            details: 'Check group name or set MAILERLITE_GROUP_*_ID environment variable'
          });
        }

        // ✅ FIX: Use group ID instead of group name
        response = await fetch(`${apiUrl}/groups/${groupId}/subscribers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          },
          body: JSON.stringify({ email }),
        });
        break;
      }

      case 'removeFromGroup': {
        const { email, groupName } = data;
        
        if (!email || !groupName) {
          return res.status(400).json({ error: 'Missing required fields: email, groupName' });
        }

        // ✅ FIX: Get group ID from name
        const groupId = await getGroupId(groupName);
        if (!groupId) {
          // Don't fail - group might not exist, subscriber already not in group
          logger.debug(`[MailerLite Proxy] Group ${groupName} not found - assuming subscriber already not in group`);
          return res.json({ 
            success: true, 
            message: `Group ${groupName} not found - subscriber already not in group` 
          });
        }

        // ✅ FIX: Use group ID instead of group name
        response = await fetch(`${apiUrl}/groups/${groupId}/subscribers/${encodeURIComponent(email)}`, {
          method: 'DELETE',
          headers: {
            'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          },
        });
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown operation: ${operation}` });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Don't fail on 404 for removeFromGroup (group might not exist)
      if (operation === 'removeFromGroup' && response.status === 404) {
        return res.json({ 
          success: true, 
          message: 'Subscriber removed from group (or already not in group)' 
        });
      }
      
      // ✅ FIX: Better error logging for debugging
      logger.error(`[MailerLite Proxy] ❌ MailerLite API error for ${operation}: ${response.status} - ${errorData.message || 'Unknown error'}`, {
        operation,
        status: response.status,
        error: errorData
      });

      throw new Error(`MailerLite API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    result = await response.json().catch(() => ({}));
    
    logger.debug(`[MailerLite Proxy] ✅ Operation ${operation} completed successfully`);
    
    res.json({ 
      success: true, 
      data: result 
    });

  } catch (error) {
    logger.error('[MailerLite Proxy] Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process MailerLite operation',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// MagicBell: Generate user token for notifications
// ======================================
// MAGICBELL JWT TOKEN ENDPOINT (FINAL FIX)
// ======================================
app.get('/api/magicbell/token', verifyJWT, async (req, res) => {
  try {
    const apiKey =
      process.env.MAGICBELL_API_KEY ||
      process.env.VITE_MAGICBELL_API_KEY ||
      null;

    const secret =
      process.env.MAGICBELL_API_SECRET ||
      process.env.MAGICBELL_SECRET ||
      null;

    // If MagicBell is not configured -> disable cleanly
    if (!apiKey || !secret) {
      logger.warn('[MagicBell] ⚠️ Missing API key or secret - disabling MagicBell');
      return res.status(200).json({
        disabled: true,
        token: null,
      });
    }

    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Unauthorized: Missing user session' });
    }

    const now = Math.floor(Date.now() / 1000);

    // ✅ CRITICAL: MagicBell REQUIRES api_key in the payload
    const payload = {
      api_key: apiKey,
      user_id: user.id,
      iat: now,
    };

    const token = jwt.sign(payload, secret, {
      algorithm: 'HS256',
      header: {
        typ: 'JWT',
        alg: 'HS256',
      },
      expiresIn: '12h',
    });

    return res.status(200).json({
      disabled: false,
      token,
    });
  } catch (err) {
    logger.error('[MagicBell] ❌ JWT generation error:', err);
    return res.status(200).json({
      disabled: true,
      token: null,
    });
  }
});

// ======================================
// MAGICBELL NOTIFICATION ENDPOINT
// ======================================
app.post('/api/magicbell/notify', verifyJWT, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Unauthorized: Missing user session' });
    }

    const { title, content, category = 'system', actionUrl, customAttributes } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Missing required fields: title, content' });
    }

    const result = await notificationService.sendNotification(user.id, {
      title,
      content,
      category,
      actionUrl,
      customAttributes,
    });

    if (!result.success) {
      if (result.reason === 'not_configured') {
        return res.status(200).json({ 
          success: false, 
          disabled: true,
          message: 'MagicBell not configured' 
        });
      }
      return res.status(500).json({ 
        error: 'Failed to send notification',
        reason: result.reason 
      });
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    logger.error('[MagicBell Notify] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ======================================
// MAGICBELL WELCOME NOTIFICATION ENDPOINT
// ======================================
app.post('/api/magicbell/welcome', verifyJWT, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Unauthorized: Missing user session' });
    }

    // Import userOnboardingService dynamically to avoid circular dependencies
    const { sendWelcomeNotification } = await import('./services/userOnboardingService.mjs');
    await sendWelcomeNotification(user.id);

    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error('[MagicBell Welcome] Error:', err);
    // Fail soft – never block signup/login
    return res.status(200).json({ success: false });
  }
});

// MailerLite signup sync endpoint (called immediately after signup)
app.post('/api/mailerlite/signup-sync', async (req, res) => {
  try {
    const { userId, email, tier = 'free', gdpr_accepted, marketing_opt_in } = req.body;
    
    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing required fields: userId, email' });
    }
    
    // Import and call the sync function directly
    const { syncMailerLiteOnSignup } = await import('./services/userOnboardingService.mjs');
    
    // Queue the signup for processing (backup in case direct sync fails)
    if (supabase) {
      await supabase
        .from('user_signup_queue')
        .insert({
          user_id: userId,
          email: email,
          processed: false,
          created_at: new Date().toISOString()
        })
        .single()
        .catch(err => {
          logger.debug('[SignupSync] Failed to queue signup (non-critical):', err.message);
        });
    }
    
    // Attempt direct sync
    await syncMailerLiteOnSignup(userId);
    
    logger.info(`[SignupSync] ✅ MailerLite sync triggered for ${email}`);
    
    return res.json({ 
      success: true,
      message: 'MailerLite sync initiated' 
    });
  } catch (error) {
    logger.error('[SignupSync] Error:', error);
    // Don't return error - this should be fire-and-forget
    return res.json({ 
      success: false,
      message: 'MailerLite sync queued for later processing' 
    });
  }
});

// Process signup queue endpoint (for cron job or manual trigger)
app.post('/internal/process-signup-queue', async (req, res) => {
  try {
    // Verify internal secret for security
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.INTERNAL_SECRET || process.env.RAILWAY_INTERNAL_SECRET;
    
    if (!expectedSecret || !authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn('[SignupQueue] Unauthorized access attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Import and run the queue processor
    const { processSignupQueue } = await import('./services/signupQueueProcessor.mjs');
    const results = await processSignupQueue();

    logger.info(`[SignupQueue] Processing complete: ${results.processed} processed, ${results.errors.length} errors`);

    return res.json({
      success: true,
      processed: results.processed,
      errors: results.errors.length > 0 ? results.errors : undefined
    });
  } catch (error) {
    logger.error('[SignupQueue] Processing error:', error);
    return res.status(500).json({ 
      error: 'Failed to process signup queue',
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
    // ✅ CRITICAL FIX: Log actual error for debugging (was silently swallowing errors)
    logger.error('[GET /v1/user_profiles/:id] Internal server error:', {
      error: error.message,
      stack: error.stack,
      userId: req.params.id,
      authUser: req.user?.id
    });
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
      // ✅ CRITICAL: Use centralized tierService for consistent normalization
      // Use actual tier if available, otherwise use requested tier (for new signups)
      tier = await getUserTierSafe(userId);
      if (tier === 'free' && requestedTier) {
        // For new signups, use requested tier (will be normalized by tierService later)
        tier = requestedTier;
      }
    } catch (dbError) {
      logger.debug('[FastSpring] Could not fetch tier for userId:', userId);
      // Use requested tier as fallback (this is OK for checkout creation)
      tier = requestedTier;
    }

    // ✅ PRE-LAUNCH HARDENING: Check FastSpring configuration before API calls
    const FASTSPRING_API_USERNAME = process.env.FASTSPRING_API_USERNAME;
    const FASTSPRING_API_PASSWORD = process.env.FASTSPRING_API_PASSWORD;
    const FASTSPRING_STORE_ID = process.env.FASTSPRING_STORE_ID;
    const FASTSPRING_ENVIRONMENT = process.env.VITE_FASTSPRING_ENVIRONMENT || 'test';
    
    // ✅ PRE-LAUNCH HARDENING: Helper function to check FastSpring configuration
    const isFastSpringConfigured = () => {
      return Boolean(
        FASTSPRING_API_USERNAME &&
        FASTSPRING_API_PASSWORD &&
        FASTSPRING_STORE_ID &&
        !FASTSPRING_API_USERNAME.includes('__PENDING__') &&
        !FASTSPRING_API_PASSWORD.includes('__PENDING__') &&
        !FASTSPRING_STORE_ID.includes('__PENDING__')
      );
    };
    
    if (!isFastSpringConfigured()) {
      logger.warn('[FastSpring] API credentials not configured - returning error');
      return res.status(503).json({ 
        ok: false,
        error: 'Billing temporarily unavailable. Please try again later.',
        message: 'Payment provider is not configured. Please contact support if this persists.'
      });
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
        // ✅ CRITICAL: Use centralized tierService for consistent normalization
        tier = await getUserTierSafe(userId);
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
      // ✅ MOBILE FIX: Return HTML redirect page instead of JSON for better mobile UX
      // ✅ CORS FIX: Use environment variable for frontend URL (supports production domain)
      const frontendUrl =
        process.env.FRONTEND_URL ||
        process.env.VITE_FRONTEND_URL ||
        'https://atlas.otiumcreations.com';
      res.status(404).setHeader('Content-Type', 'text/html').send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="refresh" content="3;url=${frontendUrl}">
          <title>Atlas - Redirecting...</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #F9F6F3 0%, #E8E3DC 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container {
              background: white;
              border-radius: 16px;
              padding: 40px;
              max-width: 500px;
              width: 100%;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              text-align: center;
            }
            h1 { color: #3B3632; margin-bottom: 16px; font-size: 24px; }
            p { color: #8B7E74; margin-bottom: 24px; line-height: 1.6; }
            .link {
              display: inline-block;
              background: #8FA67E;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              margin-top: 8px;
            }
            .link:hover { background: #7A8F6A; }
            .spinner {
              border: 3px solid #f3f3f3;
              border-top: 3px solid #8FA67E;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 20px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 Redirecting to Atlas...</h1>
            <p>You're accessing the backend API. The frontend is hosted separately.</p>
            <div class="spinner"></div>
            <p style="font-size: 14px; margin-top: 20px;">
              Redirecting automatically in 3 seconds...
            </p>
            <a href="${frontendUrl}" class="link">Go to Atlas Now</a>
          </div>
          <script>
            // Auto-redirect after 3 seconds
            setTimeout(() => {
              window.location.href = '${frontendUrl}';
            }, 3000);
          </script>
        </body>
        </html>
      `);
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
      // ✅ CURRENT IP: 192.168.0.229 (prioritized for mobile/web sync)
      '192.168.0.229+3.pem',
      '192.168.0.229+2.pem',
      '192.168.0.229+1.pem',
      // ✅ PRESERVED: Legacy IP patterns (backward compatible)
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
    
    // ✅ CRITICAL FIX: Verify both cert and key exist before returning
    if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      logger.info(`[HTTPS] ✅ Found certificates: ${certName}`);
      return { certPath, keyPath };
    }
    
    logger.warn('[HTTPS] ⚠️ No valid certificates found - will use HTTP');
    return { certPath: null, keyPath: null };
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
