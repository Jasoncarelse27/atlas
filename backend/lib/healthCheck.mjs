// Enhanced health check system
import { logger } from './simpleLogger.mjs';
import { supabase } from '../config/supabaseClient.mjs';

/**
 * Comprehensive health check
 */
export async function performHealthCheck() {
  const startTime = Date.now();
  const checks = {
    server: { status: 'ok', message: 'Server is running' },
    database: { status: 'unknown', message: 'Not checked' },
    memory: { status: 'unknown', message: 'Not checked' },
    uptime: process.uptime()
  };

  // Database connectivity check
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      checks.database = { 
        status: 'error', 
        message: `Database connection failed: ${error.message}` 
      };
    } else {
      checks.database = { 
        status: 'ok', 
        message: 'Database connection successful' 
      };
    }
  } catch (error) {
    checks.database = { 
      status: 'error', 
      message: `Database check failed: ${error.message}` 
    };
  }

  // Memory usage check
  const memUsage = process.memoryUsage();
  const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  checks.memory = {
    status: memUsageMB > 500 ? 'warning' : 'ok',
    message: `Memory usage: ${memUsageMB}MB`,
    details: {
      heapUsed: memUsageMB,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    }
  };

  // Overall health status
  const hasErrors = Object.values(checks).some(check => 
    typeof check === 'object' && check.status === 'error'
  );
  
  const hasWarnings = Object.values(checks).some(check => 
    typeof check === 'object' && check.status === 'warning'
  );

  const overallStatus = hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok';
  const responseTime = Date.now() - startTime;

  const healthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    responseTime: `${responseTime}ms`,
    checks
  };

  // Log health check if there are issues
  if (overallStatus !== 'ok') {
    logger.warn('Health check detected issues', healthStatus);
  }

  return healthStatus;
}

/**
 * Simple health check for fast endpoints
 */
export function getBasicHealth() {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    version: '1.0.0',
    service: 'atlas-backend'
  };
}
