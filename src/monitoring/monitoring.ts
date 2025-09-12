/**
 * Monitoring shim:
 * - Safe to import anywhere (browser/node)
 * - Forwards to Sentry if present
 * - Also emits console.debug in dev for visibility
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type Breadcrumb = { category?: string; message?: string; data?: Record<string, unknown> };

let _sentry: unknown;
try {
  // Optional import; will be undefined if not installed/initialized in this environment
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _sentry = require('@sentry/browser');
} catch (error) {
  // Sentry not available in this environment
  console.debug('Sentry not available:', error);
}

export function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  if (import.meta?.env?.DEV) {
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : level](`[monitoring] ${message}`, data ?? {});
  }
  if (!_sentry) return;
  const extra = data ?? {};
  switch (level) {
    case 'error':
      _sentry.captureException(new Error(message), { extra });
      break;
    default:
      _sentry.captureMessage(message, { level, extra });
  }
}

export function breadcrumb(b: Breadcrumb) {
  if (!_sentry) return;
  _sentry.addBreadcrumb({ category: b.category, message: b.message, data: b.data });
}
