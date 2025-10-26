/**
 * Sentry Error Tracking Service
 * Unified error tracking for web and mobile with PII masking
 */

import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/react';

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
  'cookie'
];

/**
 * Initialize Sentry error tracking
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    // Silent when no DSN - this is normal for local development
    return;
  }

  const environment = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development';
  const isProduction = environment === 'production';

  try {
    Sentry.init({
      dsn,
      environment,
      
      // Performance monitoring
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      
      // Performance sampling
      tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in production, 100% in dev
      
      // Release tracking
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',
      
      // Only send errors in production/staging
      enabled: environment !== 'development',
      
      // Filter out noise
      ignoreErrors: [
        // Browser extensions
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // Network errors
        'Network request failed',
        'NetworkError',
        'Failed to fetch',
        // User cancellations
        'AbortError',
        'The user aborted a request',
        // Common browser quirks
        'Non-Error promise rejection captured',
        // Safari specific
        'SecurityError: Blocked a frame with origin',
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
          });
        }
        
        // Mask PII in breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => ({
            ...breadcrumb,
            message: breadcrumb.message ? maskPII(breadcrumb.message) : undefined,
            data: breadcrumb.data ? maskPIIInObject(breadcrumb.data) : undefined,
          }));
        }
        
        // Mask PII in context
        if (event.contexts) {
          event.contexts = maskPIIInObject(event.contexts);
        }
        
        // Mask PII in extra data
        if (event.extra) {
          event.extra = maskPIIInObject(event.extra);
        }
        
        // Add Atlas-specific context
        event.tags = {
          ...event.tags,
          atlas_version: import.meta.env.VITE_APP_VERSION || '1.0.0',
          platform: getPlatform(),
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

    logger.info(`[Sentry] Initialized for ${environment} environment`);
  } catch (error) {
    logger.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Mask PII in a string
 */
function maskPII(str: string): string {
  let masked = str;
  
  // Mask email addresses
  masked = masked.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[EMAIL]');
  
  // Mask phone numbers (various formats)
  masked = masked.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');
  
  // Mask SSN
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  
  // Mask credit card numbers
  masked = masked.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CREDIT_CARD]');
  
  // Mask UUIDs (potential user IDs)
  masked = masked.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID]');
  
  // Mask auth tokens (common patterns)
  masked = masked.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [TOKEN]');
  masked = masked.replace(/token[=:]\s*[A-Za-z0-9\-._~+/]+=*/gi, 'token=[TOKEN]');
  
  return masked;
}

/**
 * Mask PII in an object recursively
 */
function maskPIIInObject(obj: Record<string, unknown>): Record<string, unknown> {
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
 * Get platform (web/mobile)
 */
function getPlatform(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod|android/i.test(userAgent)) {
    return 'mobile';
  }
  
  return 'web';
}

/**
 * Capture exception with additional context
 */
export function captureException(error: Error | unknown, context?: Record<string, any>) {
  // Add Atlas-specific context
  const atlasContext = {
    ...context,
    timestamp: new Date().toISOString(),
    platform: getPlatform(),
    url: window.location.href,
  };
  
  // Log locally as well
  logger.error('[Sentry] Capturing exception:', error, atlasContext);
  
  // Send to Sentry
  Sentry.captureException(error, {
    extra: maskPIIInObject(atlasContext),
  });
}

/**
 * Capture message with level
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  const maskedMessage = maskPII(message);
  
  logger.info(`[Sentry] Capturing message (${level}):`, maskedMessage);
  
  Sentry.captureMessage(maskedMessage, level);
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>;
}) {
  Sentry.addBreadcrumb({
    ...breadcrumb,
    message: maskPII(breadcrumb.message),
    data: breadcrumb.data ? maskPIIInObject(breadcrumb.data) : undefined,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context (with PII protection)
 */
export function setUserContext(user: { id: string; tier?: string }) {
  Sentry.setUser({
    id: user.id, // Only send non-PII user ID
    // Don't send email, name, or other PII
    tier: user.tier,
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Create Sentry error boundary wrapper
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// Export Sentry instance for advanced usage
export { Sentry };

