/**
 * Atlas AI Sentry Integration
 * Error monitoring and performance tracking with Sentry.io
 */

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  debug?: boolean;
  tracesSampleRate?: number;
  beforeSend?: (event: any) => any;
}

class SentryService {
  private isInitialized = false;
  private config: SentryConfig = {};

  /**
   * Initialize Sentry with configuration
   */
  init(config: SentryConfig = {}): void {
    this.config = {
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',
      debug: import.meta.env.MODE === 'development',
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
      ...config,
    };

    // Only initialize if DSN is provided
    if (this.config.dsn) {
      this.initializeSentry();
    } else {
      this.isInitialized = true;
    }
  }

  /**
   * Capture an exception
   */
  captureException(error: unknown, context?: Record<string, any>): string {
    if (!this.isInitialized) {
      return this.mockCaptureException(error, context);
    }

    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        return (window as any).Sentry.captureException(error, context);
      }
    } catch (sentryError) {
    }

    return this.mockCaptureException(error, context);
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>): string {
    if (!this.isInitialized) {
      return this.mockCaptureMessage(message, level, context);
    }

    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        return (window as any).Sentry.captureMessage(message, level, context);
      }
    } catch (sentryError) {
    }

    return this.mockCaptureMessage(message, level, context);
  }

  /**
   * Set user context
   */
  setUser(user: { id?: string; email?: string; username?: string; [key: string]: any }): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.setUser(user);
      }
    } catch (sentryError) {
    }
  }

  /**
   * Set additional context
   */
  setContext(key: string, context: Record<string, any>): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.setContext(key, context);
      }
    } catch (sentryError) {
    }
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: {
    message?: string;
    category?: string;
    level?: 'info' | 'warning' | 'error';
    data?: Record<string, any>;
  }): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.addBreadcrumb(breadcrumb);
      }
    } catch (sentryError) {
    }
  }

  /**
   * Start a transaction for performance monitoring
   */
  startTransaction(name: string, op: string = 'navigation'): any {
    if (!this.isInitialized) {
      return this.mockTransaction(name, op);
    }

    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        return (window as any).Sentry.startTransaction({ name, op });
      }
    } catch (sentryError) {
    }

    return this.mockTransaction(name, op);
  }

  /**
   * Get current Sentry configuration
   */
  getConfig(): SentryConfig {
    return { ...this.config };
  }

  /**
   * Check if Sentry is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  private initializeSentry(): void {
    try {
      // Dynamic import to avoid bundling Sentry in development
      import('@sentry/browser').then((Sentry) => {
        Sentry.init({
          dsn: this.config.dsn,
          environment: this.config.environment,
          release: this.config.release,
          debug: this.config.debug,
          tracesSampleRate: this.config.tracesSampleRate,
          beforeSend: this.config.beforeSend,
          integrations: [
            new Sentry.BrowserTracing(),
          ],
        });

        // Make Sentry available globally
        if (typeof window !== 'undefined') {
          (window as any).Sentry = Sentry;
        }

        this.isInitialized = true;
      }).catch((error) => {
        this.isInitialized = true; // Mark as initialized to use mock
      });
    } catch (error) {
      this.isInitialized = true; // Mark as initialized to use mock
    }
  }

  private mockCaptureException(error: unknown, context?: Record<string, any>): string {
    const errorId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      errorId,
      error,
      context,
      timestamp: new Date().toISOString(),
    });
    return errorId;
  }

  private mockCaptureMessage(message: string, level: string, context?: Record<string, any>): string {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      messageId,
      message,
      context,
      timestamp: new Date().toISOString(),
    });
    return messageId;
  }

  private mockTransaction(name: string, op: string): any {
    return {
      name,
      op,
    };
  }
}

// Create singleton instance
export const Sentry = new SentryService();

// Export convenience functions
export const captureException = (error: unknown, context?: Record<string, any>) => 
  Sentry.captureException(error, context);

export const captureMessage = (message: string, level?: 'info' | 'warning' | 'error', context?: Record<string, any>) => 
  Sentry.captureMessage(message, level, context);

export const setUser = (user: { id?: string; email?: string; username?: string; [key: string]: any }) => 
  Sentry.setUser(user);

export const setContext = (key: string, context: Record<string, any>) => 
  Sentry.setContext(key, context);

export const addBreadcrumb = (breadcrumb: {
  message?: string;
  category?: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}) => Sentry.addBreadcrumb(breadcrumb);

export const startTransaction = (name: string, op?: string) => 
  Sentry.startTransaction(name, op);

export default Sentry;
