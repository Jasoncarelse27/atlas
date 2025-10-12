/**
 * Atlas AI Error Logger
 * Centralized error logging with context and optional external service integration
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  conversationId?: string;
  messageId?: string;
  timestamp?: string;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, any>;
}

export interface LoggedError {
  id: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

class ErrorLogger {
  private errors: LoggedError[] = [];
  private maxErrors = 100; // Keep last 100 errors in memory

  /**
   * Log an error with optional context
   */
  log(error: unknown, context: ErrorContext = {}, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): string {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();
    
    let message = 'Unknown error';
    let stack: string | undefined;

    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      message = JSON.stringify(error);
    }

    const loggedError: LoggedError = {
      id: errorId,
      message,
      stack,
      context: {
        ...context,
        timestamp,
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
      severity,
      timestamp,
    };

    // Add to memory store
    this.errors.unshift(loggedError);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Console logging with emoji based on severity
    const emoji = this.getSeverityEmoji(severity);
    console.log(`${emoji} [ErrorLogger]`, {
      message,
      context,
      severity,
      timestamp,
    });

    // Log stack trace if available
    if (stack) {
      console.error('Stack trace:', stack);
    }

    // Send to external services if configured
    this.sendToExternalServices(loggedError);

    return errorId;
  }

  /**
   * Log a critical error that requires immediate attention
   */
  critical(error: unknown, context: ErrorContext = {}): string {
    return this.log(error, context, 'critical');
  }

  /**
   * Log a high priority error
   */
  high(error: unknown, context: ErrorContext = {}): string {
    return this.log(error, context, 'high');
  }

  /**
   * Log a medium priority error
   */
  medium(error: unknown, context: ErrorContext = {}): string {
    return this.log(error, context, 'medium');
  }

  /**
   * Log a low priority error
   */
  low(error: unknown, context: ErrorContext = {}): string {
    return this.log(error, context, 'low');
  }

  /**
   * Get all logged errors
   */
  getErrors(): LoggedError[] {
    return [...this.errors];
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: LoggedError['severity']): LoggedError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Get errors by component
   */
  getErrorsByComponent(component: string): LoggedError[] {
    return this.errors.filter(error => error.context.component === component);
  }

  /**
   * Clear all logged errors
   */
  clear(): void {
    this.errors = [];
  }

  /**
   * Export errors as JSON
   */
  exportErrors(): string {
    return JSON.stringify(this.errors, null, 2);
  }

  /**
   * Get error statistics
   */
  getStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byComponent: Record<string, number>;
    recentErrors: number; // Last 24 hours
  } {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const bySeverity = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byComponent = this.errors.reduce((acc, error) => {
      const component = error.context.component || 'unknown';
      acc[component] = (acc[component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentErrors = this.errors.filter(error => 
      new Date(error.timestamp) > oneDayAgo
    ).length;

    return {
      total: this.errors.length,
      bySeverity,
      byComponent,
      recentErrors,
    };
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSeverityEmoji(severity: LoggedError['severity']): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '❌';
    }
  }

  private sendToExternalServices(error: LoggedError): void {
    // Send to Sentry if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      try {
        (window as any).Sentry.captureException(new Error(error.message), {
          tags: {
            component: error.context.component,
            action: error.context.action,
            severity: error.severity,
          },
          extra: error.context,
        });
      } catch (sentryError) {
        console.error('[ErrorLogger] Sentry error:', sentryError);
      }
    }

    // Send to custom analytics endpoint if configured
    if (import.meta.env.VITE_ERROR_ANALYTICS_ENDPOINT) {
      this.sendToAnalytics(error).catch(analyticsError => {
      });
    }
  }

  private async sendToAnalytics(error: LoggedError): Promise<void> {
    try {
      await fetch(import.meta.env.VITE_ERROR_ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...error,
          appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
          environment: import.meta.env.MODE,
        }),
      });
    } catch (fetchError) {
      // Don't log analytics errors to avoid infinite loops
    }
  }
}

// Create singleton instance
export const errorLogger = new ErrorLogger();

// Export convenience functions
export const logError = (error: unknown, context?: ErrorContext) => errorLogger.log(error, context);
export const logCritical = (error: unknown, context?: ErrorContext) => errorLogger.critical(error, context);
export const logHigh = (error: unknown, context?: ErrorContext) => errorLogger.high(error, context);
export const logMedium = (error: unknown, context?: ErrorContext) => errorLogger.medium(error, context);
export const logLow = (error: unknown, context?: ErrorContext) => errorLogger.low(error, context);

export default errorLogger;
