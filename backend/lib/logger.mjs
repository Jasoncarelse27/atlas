// Enhanced logging system for Atlas backend
import winston from 'winston';
import { supabase } from './supabaseClient.mjs';

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'atlas-backend',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  },
  transports: [
    // Console logging for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      )
    })
  ]
});

// Production file logging
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }));
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log'
  }));
}

/**
 * Log error to Supabase for monitoring
 */
async function logErrorToSupabase(error, context = {}) {
  try {
    const errorLog = {
      error_message: error.message || String(error),
      error_stack: error.stack || null,
      context: context,
      timestamp: new Date().toISOString(),
      service: 'atlas-backend',
      environment: process.env.NODE_ENV || 'development'
    };

    // Only log to Supabase in production or when explicitly enabled
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SUPABASE_LOGGING === 'true') {
      const { error: supabaseError } = await supabase
        .from('error_logs')
        .insert([errorLog]);

      if (supabaseError) {
        logger.error('Failed to log error to Supabase:', supabaseError);
      }
    }
  } catch (logError) {
    logger.error('Critical: Failed to log error to Supabase:', logError);
  }
}

/**
 * Enhanced logger with Supabase integration
 */
const enhancedLogger = {
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  error: async (message, error = null, context = {}) => {
    logger.error(message, { error: error?.message, ...context });
    
    if (error) {
      await logErrorToSupabase(error, { message, ...context });
    }
  },
  debug: (message, meta = {}) => logger.debug(message, meta),
  http: (req, res, responseTime) => {
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`
    });
  }
};

export { logErrorToSupabase, enhancedLogger as logger };

