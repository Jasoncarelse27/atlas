/**
 * Atlas Production-Ready Logger
 * Simple, future-proof logger that respects environment
 * Automatically strips debug logs in production builds
 */

const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

export const logger = {
  /**
   * Development-only debug logs
   * Automatically stripped in production builds via Vite terser
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  /**
   * Always log warnings (important for production debugging)
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  
  /**
   * Always log errors (critical for production monitoring)
   */
  error: (...args: any[]) => {
    console.error(...args);
    
    // Send to Sentry in production/staging
    if (!isDevelopment) {
      // Dynamic import to avoid circular dependency
      import('../services/sentryService').then(({ captureException }) => {
        if (args[0] instanceof Error) {
          captureException(args[0], { source: 'logger' });
        }
      }).catch(() => {
        // Sentry not available, fail silently
      });
    }
  },
  
  /**
   * Production-safe info logging
   * Only logs in non-production environments
   */
  info: (...args: any[]) => {
    if (!isProduction) {
      console.log(...args);
    }
  },

  /**
   * Critical logs that should always appear
   * Use sparingly for truly critical information
   */
  critical: (...args: any[]) => {
    console.error('🚨 CRITICAL:', ...args);
  }
};

export default logger;
