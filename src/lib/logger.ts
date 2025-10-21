 

// ⚡ PERFORMANCE: Silence debug logs in production to reduce console spam
const IS_PRODUCTION = import.meta.env.PROD;
const noop = () => {};

export const logger = {
  /**
   * Debug logs - ONLY in development
   * Silent in production to prevent console spam
   */
  debug: IS_PRODUCTION ? noop : console.log,
  
  /**
   * Info logs - visible in all environments
   */
  info: console.log,
  
  /**
   * Warning logs - visible in all environments
   */
  warn: console.warn,
  
  /**
   * Error logs - visible in all environments
   */
  error: console.error,
};
