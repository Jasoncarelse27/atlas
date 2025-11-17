/**
 * Error Boundary Component with Sentry Integration
 * Catches React errors and displays user-friendly fallback
 */

import { logger } from '@/lib/logger';
import { captureException } from '@/services/sentryService';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import React, { Component } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // ✅ ALWAYS log to console (even in production) for debugging widget issues
    console.error('[ErrorBoundary] ❌ Error caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
    
    // Also log via logger
    logger.error('Error caught by boundary:', error, errorInfo);

    // Send to Sentry with React component stack
    captureException(error, {
      errorBoundary: true,
      componentStack: errorInfo.componentStack,
      props: this.props,
    });

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                    Something went wrong
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    We've encountered an unexpected error. Our team has been notified and is working on a fix.
                  </p>
                </div>
              </div>
            </div>

            {/* Error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-mono text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {this.state.error.name}: {this.state.error.message}
                </h4>
                {this.state.errorInfo && (
                  <pre className="text-xs overflow-auto max-h-40 p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button 
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                Try Again
              </button>
              <button 
                onClick={this.handleReload}
                className="flex-1 px-4 py-2 bg-atlas-sage text-white rounded-lg hover:bg-atlas-success font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to reset error boundary from child components
 */
export function useErrorBoundary() {
  const [resetKey, setResetKey] = React.useState(0);

  const resetErrorBoundary = React.useCallback(() => {
    setResetKey((key) => key + 1);
  }, []);

  return { resetKey, resetErrorBoundary };
}