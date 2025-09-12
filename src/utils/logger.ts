/**
 * Safe logging utility for production code
 * Replaces console.log statements with a controlled logging system
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    this.config = {
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
      enableConsole: process.env.NODE_ENV === 'development',
      enableRemote: process.env.NODE_ENV === 'production',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      if (this.config.enableConsole) {
        console.debug(this.formatMessage('debug', message), ...args);
      }
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      if (this.config.enableConsole) {
        console.info(this.formatMessage('info', message), ...args);
      }
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      if (this.config.enableConsole) {
        console.warn(this.formatMessage('warn', message), ...args);
      }
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      if (this.config.enableConsole) {
        console.error(this.formatMessage('error', message), ...args);
      }
    }
  }

  // Legacy method for backward compatibility
  log(message: string, ...args: unknown[]): void {
    this.info(message, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for use in other files
export type { LogLevel, LoggerConfig };
