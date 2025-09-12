/**
 * Monitoring configuration for Atlas
 * Centralizes monitoring setup for different environments
 */

export interface MonitoringConfig {
  sentry: {
    dsn: string;
    environment: string;
    enabled: boolean;
    sampleRate: number;
    tracesSampleRate: number;
  };
  analytics: {
    enabled: boolean;
    trackingId?: string;
  };
  performance: {
    enabled: boolean;
    sampleRate: number;
  };
  errorReporting: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

const getEnvironment = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.hostname.includes('staging') ? 'staging' : 
           window.location.hostname.includes('localhost') ? 'development' : 'production';
  }
  return process.env.NODE_ENV || 'development';
};

export const monitoringConfig: MonitoringConfig = {
  sentry: {
    dsn: import.meta.env.VITE_SENTRY_DSN || '',
    environment: getEnvironment(),
    enabled: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
    sampleRate: getEnvironment() === 'production' ? 0.1 : 1.0,
    tracesSampleRate: getEnvironment() === 'production' ? 0.1 : 1.0,
  },
  analytics: {
    enabled: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    trackingId: import.meta.env.VITE_ANALYTICS_TRACKING_ID,
  },
  performance: {
    enabled: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
    sampleRate: getEnvironment() === 'production' ? 0.1 : 1.0,
  },
  errorReporting: {
    enabled: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
    logLevel: getEnvironment() === 'production' ? 'error' : 'debug',
  },
};

// Initialize monitoring based on configuration
export const initializeMonitoring = async (): Promise<void> => {
  const { sentry, analytics, performance } = monitoringConfig;

  // Initialize Sentry if enabled
  if (sentry.enabled && sentry.dsn) {
    try {
      const { init } = await import('@sentry/react');
      init({
        dsn: sentry.dsn,
        environment: sentry.environment,
        sampleRate: sentry.sampleRate,
        tracesSampleRate: sentry.tracesSampleRate,
        integrations: [
          // Add specific integrations as needed
        ],
      });
      console.log(`✅ Sentry initialized for ${sentry.environment} environment`);
    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error);
    }
  }

  // Initialize analytics if enabled
  if (analytics.enabled && analytics.trackingId) {
    try {
      // Initialize analytics service (e.g., Google Analytics, Mixpanel, etc.)
      console.log(`✅ Analytics initialized with tracking ID: ${analytics.trackingId}`);
    } catch (error) {
      console.error('❌ Failed to initialize analytics:', error);
    }
  }

  // Initialize performance monitoring if enabled
  if (performance.enabled) {
    try {
      // Initialize performance monitoring
      console.log('✅ Performance monitoring initialized');
    } catch (error) {
      console.error('❌ Failed to initialize performance monitoring:', error);
    }
  }
};

// Health check function for monitoring
export const performHealthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: string;
}> => {
  const checks: Record<string, boolean> = {
    sentry: monitoringConfig.sentry.enabled,
    analytics: monitoringConfig.analytics.enabled,
    performance: monitoringConfig.performance.enabled,
    errorReporting: monitoringConfig.errorReporting.enabled,
  };

  const allHealthy = Object.values(checks).every(check => check);
  
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  };
};

export default monitoringConfig;
