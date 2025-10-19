/**
 * Sentry Error Tracking Service - Backend
 * Unified error tracking with PII masking
 */

import * as Sentry from '@sentry/node';
import { logger } from './logger.mjs';

// PII fields to mask in error reports
const PII_FIELDS = [
  'email',
  'password',
  'phone',
  'ssn',
  'creditCard',
  'name',
  'firstName',
  'lastName',
  'address',
  'userId',
  'user_id',
  'auth',
  'token',
  'session',
  'cookie',
  'authorization',
  'x-auth-token'
];

/**
 * Initialize Sentry for backend
 */
export function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.warn('[Sentry] No DSN provided, error tracking disabled');
    return;
  }

  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';

  try {
    Sentry.init({
      dsn,
      environment,
      
      // Performance monitoring
      tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in production
      
      // Release tracking
      release: process.env.APP_VERSION || '1.0.0',
      
      // Only send errors in production/staging
      enabled: environment !== 'development',
      
      // Server name (anonymized)
      serverName: 'atlas-backend',
      
      // Integrations
      integrations: [
        // HTTP integration for Express
        new Sentry.Integrations.Http({ tracing: true }),
        // Express integration
        new Sentry.Integrations.Express({ app }),
      ],
      
      // Filter out noise
      ignoreErrors: [
        // Client disconnections
        'ECONNRESET',
        'EPIPE',
        'ETIMEDOUT',
        // Supabase edge function timeouts
        'TimeoutError',
        'Request timeout',
      ],
      
      // PII Masking
      beforeSend(event, hint) {
        // Mask PII in error messages
        if (event.message) {
          event.message = maskPII(event.message);
        }
        
        // Mask PII in exception values
        if (event.exception?.values) {
          event.exception.values.forEach(exception => {
            if (exception.value) {
              exception.value = maskPII(exception.value);
            }
            // Mask stack traces
            if (exception.stacktrace?.frames) {
              exception.stacktrace.frames = exception.stacktrace.frames.map(frame => ({
                ...frame,
                vars: frame.vars ? maskPIIInObject(frame.vars) : undefined,
              }));
            }
          });
        }
        
        // Mask PII in request data
        if (event.request) {
          event.request = maskRequestData(event.request);
        }
        
        // Mask PII in breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => ({
            ...breadcrumb,
            message: breadcrumb.message ? maskPII(breadcrumb.message) : undefined,
            data: breadcrumb.data ? maskPIIInObject(breadcrumb.data) : undefined,
          }));
        }
        
        // Add Atlas-specific context
        event.tags = {
          ...event.tags,
          atlas_version: process.env.APP_VERSION || '1.0.0',
          node_version: process.version,
        };
        
        return event;
      },
      
      // Breadcrumb filtering
      beforeBreadcrumb(breadcrumb) {
        // Filter out noisy breadcrumbs
        if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
          return null;
        }
        
        // Mask PII in breadcrumb data
        if (breadcrumb.data) {
          breadcrumb.data = maskPIIInObject(breadcrumb.data);
        }
        
        return breadcrumb;
      },
    });

    // Express error handler should be added after all other middleware
    logger.info(`[Sentry] Initialized for ${environment} environment`);
  } catch (error) {
    logger.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Get Sentry middleware for Express
 */
export function getSentryMiddleware() {
  return {
    requestHandler: Sentry.Handlers.requestHandler(),
    tracingHandler: Sentry.Handlers.tracingHandler(),
    errorHandler: Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture 4xx errors in production for monitoring
        if (error.status >= 400 && error.status < 500) {
          return process.env.NODE_ENV === 'production';
        }
        // Always capture 5xx errors
        return true;
      },
    }),
  };
}

/**
 * Mask PII in a string
 */
function maskPII(str) {
  if (typeof str !== 'string') return str;
  
  let masked = str;
  
  // Mask email addresses
  masked = masked.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[EMAIL]');
  
  // Mask phone numbers
  masked = masked.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');
  
  // Mask SSN
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  
  // Mask credit card numbers
  masked = masked.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CREDIT_CARD]');
  
  // Mask UUIDs (potential user IDs)
  masked = masked.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID]');
  
  // Mask auth tokens
  masked = masked.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [TOKEN]');
  masked = masked.replace(/token[=:]\s*[A-Za-z0-9\-._~+/]+=*/gi, 'token=[TOKEN]');
  
  // Mask API keys
  masked = masked.replace(/api[_-]?key[=:]\s*[A-Za-z0-9\-._~+/]+=*/gi, 'api_key=[API_KEY]');
  
  return masked;
}

/**
 * Mask PII in an object recursively
 */
function maskPIIInObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const masked = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in masked) {
    // Check if key contains PII field names
    const keyLower = key.toLowerCase();
    if (PII_FIELDS.some(field => keyLower.includes(field))) {
      masked[key] = '[REDACTED]';
      continue;
    }
    
    // Recursively mask nested objects
    if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskPIIInObject(masked[key]);
    } else if (typeof masked[key] === 'string') {
      masked[key] = maskPII(masked[key]);
    }
  }
  
  return masked;
}

/**
 * Mask request data
 */
function maskRequestData(request) {
  const masked = { ...request };
  
  // Mask headers
  if (masked.headers) {
    masked.headers = maskPIIInObject(masked.headers);
    // Remove sensitive headers entirely
    delete masked.headers.cookie;
    delete masked.headers.authorization;
    delete masked.headers['x-auth-token'];
  }
  
  // Mask query string
  if (masked.query_string) {
    masked.query_string = maskPII(masked.query_string);
  }
  
  // Mask data/body
  if (masked.data) {
    masked.data = maskPIIInObject(masked.data);
  }
  
  // Mask URL
  if (masked.url) {
    masked.url = maskPII(masked.url);
  }
  
  return masked;
}

/**
 * Capture exception with context
 */
export function captureException(error, context = {}) {
  // Add backend-specific context
  const backendContext = {
    ...context,
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  };
  
  // Log locally
  logger.error('[Sentry] Capturing exception:', error, backendContext);
  
  // Send to Sentry
  Sentry.captureException(error, {
    extra: maskPIIInObject(backendContext),
  });
}

/**
 * Capture message
 */
export function captureMessage(message, level = 'info') {
  const maskedMessage = maskPII(message);
  
  logger.info(`[Sentry] Capturing message (${level}):`, maskedMessage);
  
  Sentry.captureMessage(maskedMessage, level);
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(breadcrumb) {
  Sentry.addBreadcrumb({
    ...breadcrumb,
    message: maskPII(breadcrumb.message),
    data: breadcrumb.data ? maskPIIInObject(breadcrumb.data) : undefined,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context
 */
export function setUserContext(user) {
  Sentry.setUser({
    id: user.id, // Only non-PII ID
    tier: user.tier,
  });
}

/**
 * Create transaction for performance monitoring
 */
export function startTransaction(name, op = 'http.server') {
  return Sentry.startTransaction({
    name: maskPII(name),
    op,
  });
}

/**
 * Flush Sentry before shutdown
 */
export async function flushSentry(timeout = 2000) {
  try {
    await Sentry.flush(timeout);
    logger.info('[Sentry] Flushed successfully');
  } catch (error) {
    logger.error('[Sentry] Failed to flush:', error);
  }
}

// Export Sentry for advanced usage
export { Sentry };
