// Production-ready analytics service
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
}

class Analytics {
  private isEnabled: boolean;
  private queue: AnalyticsEvent[] = [];
  private isInitialized = false;

  constructor() {
    this.isEnabled = import.meta.env.PROD;
  }

  init() {
    if (this.isInitialized) return;
    
    // Initialize analytics services here
    // Example: PostHog, Mixpanel, Google Analytics
    this.isInitialized = true;
    
    // Process queued events
    this.processQueue();
  }

  track(event: AnalyticsEvent) {
    const eventWithTimestamp = {
      ...event,
      timestamp: Date.now()
    };

    if (!this.isEnabled) {
      console.log('Analytics event:', eventWithTimestamp);
      return;
    }

    if (!this.isInitialized) {
      this.queue.push(eventWithTimestamp);
      return;
    }

    this.sendEvent(eventWithTimestamp);
  }

  trackPageView(page: string) {
    this.track({
      name: 'page_view',
      properties: { page }
    });
  }

  trackError(error: Error, context?: Record<string, any>) {
    this.track({
      name: 'error',
      properties: {
        message: error.message,
        stack: error.stack,
        context
      }
    });
  }

  trackPerformance(metric: PerformanceMetric) {
    this.track({
      name: 'performance',
      properties: metric
    });
  }

  trackUserAction(action: string, properties?: Record<string, any>) {
    this.track({
      name: 'user_action',
      properties: {
        action,
        ...properties
      }
    });
  }

  private sendEvent(event: AnalyticsEvent) {
    // Send to your analytics service
    // Example: PostHog.capture(event.name, event.properties);
    console.log('Sending analytics event:', event);
  }

  private processQueue() {
    while (this.queue.length > 0) {
      const event = this.queue.shift();
      if (event) {
        this.sendEvent(event);
      }
    }
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private observer: PerformanceObserver | null = null;

  init() {
    if (typeof PerformanceObserver === 'undefined') return;

    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          this.trackNavigationTiming(navEntry);
        } else if (entry.entryType === 'measure') {
          this.trackCustomMeasure(entry);
        }
      }
    });

    this.observer.observe({ entryTypes: ['navigation', 'measure'] });
  }

  private trackNavigationTiming(entry: PerformanceNavigationTiming) {
    const metrics = {
      'dom_content_loaded': entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      'load_complete': entry.loadEventEnd - entry.loadEventStart,
      'first_paint': 0, // Would need to be measured separately
      'first_contentful_paint': 0 // Would need to be measured separately
    };

    Object.entries(metrics).forEach(([name, value]) => {
      if (value > 0) {
        analytics.trackPerformance({
          name,
          value,
          unit: 'ms'
        });
      }
    });
  }

  private trackCustomMeasure(entry: PerformanceEntry) {
    analytics.trackPerformance({
      name: entry.name,
      value: entry.duration,
      unit: 'ms'
    });
  }

  measure(name: string, fn: () => void) {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;
    
    analytics.trackPerformance({
      name,
      value: duration,
      unit: 'ms'
    });
  }
}

// Error monitoring
export class ErrorMonitor {
  init() {
    window.addEventListener('error', (event) => {
      analytics.trackError(event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      analytics.trackError(new Error(event.reason), {
        type: 'unhandled_promise_rejection'
      });
    });
  }
}

// Create singleton instances
export const analytics = new Analytics();
export const performanceMonitor = new PerformanceMonitor();
export const errorMonitor = new ErrorMonitor();

// Initialize all monitoring
export const initMonitoring = () => {
  analytics.init();
  performanceMonitor.init();
  errorMonitor.init();
}; 