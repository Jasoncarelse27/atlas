/**
 * Standardized error handling for the chat app
 * Provides consistent error types, messages, and recovery strategies
 */

export interface ChatError {
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
  retryAfter?: number;
  userAction?: string;
}

export interface ErrorContext {
  operation: string;
  userId?: string;
  conversationId?: string;
  messageId?: string;
  timestamp: string;
}

// Error codes for consistent error handling
export const ErrorCodes = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  DAILY_LIMIT_EXCEEDED: 'DAILY_LIMIT_EXCEEDED',
  MONTHLY_LIMIT_EXCEEDED: 'MONTHLY_LIMIT_EXCEEDED',
  
  // AI provider errors
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  AI_MODEL_UNAVAILABLE: 'AI_MODEL_UNAVAILABLE',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONNECTION_LOST: 'CONNECTION_LOST',
  
  // Data errors
  DATA_NOT_FOUND: 'DATA_NOT_FOUND',
  DATA_INVALID: 'DATA_INVALID',
  DATA_CONFLICT: 'DATA_CONFLICT',
  
  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INSUFFICIENT_TIER: 'INSUFFICIENT_TIER',
  
  // Unknown errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// Error message templates
const ErrorMessages = {
  [ErrorCodes.AUTH_REQUIRED]: 'Please sign in to continue',
  [ErrorCodes.AUTH_EXPIRED]: 'Your session has expired. Please sign in again',
  [ErrorCodes.AUTH_INVALID]: 'Invalid authentication. Please try again',
  
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment',
  [ErrorCodes.DAILY_LIMIT_EXCEEDED]: 'Daily message limit reached. Upgrade to send more messages',
  [ErrorCodes.MONTHLY_LIMIT_EXCEEDED]: 'Monthly limit reached. Please upgrade your plan',
  
  [ErrorCodes.AI_PROVIDER_UNAVAILABLE]: 'AI service temporarily unavailable. Please try again',
  [ErrorCodes.AI_MODEL_UNAVAILABLE]: 'Selected AI model unavailable. Using fallback model',
  [ErrorCodes.AI_QUOTA_EXCEEDED]: 'AI quota exceeded. Please try again later',
  
  [ErrorCodes.NETWORK_ERROR]: 'Network error. Please check your connection',
  [ErrorCodes.TIMEOUT_ERROR]: 'Request timed out. Please try again',
  [ErrorCodes.CONNECTION_LOST]: 'Connection lost. Reconnecting...',
  
  [ErrorCodes.DATA_NOT_FOUND]: 'Requested data not found',
  [ErrorCodes.DATA_INVALID]: 'Invalid data provided',
  [ErrorCodes.DATA_CONFLICT]: 'Data conflict detected',
  
  [ErrorCodes.PERMISSION_DENIED]: 'You don\'t have permission for this action',
  [ErrorCodes.INSUFFICIENT_TIER]: 'This feature requires a higher tier. Please upgrade',
  
  [ErrorCodes.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again',
} as const;

// Error recovery strategies
const RecoveryStrategies = {
  [ErrorCodes.AUTH_REQUIRED]: { retryAfter: 0, userAction: 'Sign in' },
  [ErrorCodes.AUTH_EXPIRED]: { retryAfter: 0, userAction: 'Sign in again' },
  [ErrorCodes.AUTH_INVALID]: { retryAfter: 0, userAction: 'Check credentials' },
  
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: { retryAfter: 60, userAction: 'Wait and retry' },
  [ErrorCodes.DAILY_LIMIT_EXCEEDED]: { retryAfter: 86400, userAction: 'Upgrade plan' },
  [ErrorCodes.MONTHLY_LIMIT_EXCEEDED]: { retryAfter: 2592000, userAction: 'Upgrade plan' },
  
  [ErrorCodes.AI_PROVIDER_UNAVAILABLE]: { retryAfter: 30, userAction: 'Retry' },
  [ErrorCodes.AI_MODEL_UNAVAILABLE]: { retryAfter: 0, userAction: 'Use fallback' },
  [ErrorCodes.AI_QUOTA_EXCEEDED]: { retryAfter: 3600, userAction: 'Wait and retry' },
  
  [ErrorCodes.NETWORK_ERROR]: { retryAfter: 5, userAction: 'Check connection' },
  [ErrorCodes.TIMEOUT_ERROR]: { retryAfter: 10, userAction: 'Retry' },
  [ErrorCodes.CONNECTION_LOST]: { retryAfter: 2, userAction: 'Wait for reconnect' },
  
  [ErrorCodes.DATA_NOT_FOUND]: { retryAfter: 0, userAction: 'Check input' },
  [ErrorCodes.DATA_INVALID]: { retryAfter: 0, userAction: 'Fix input' },
  [ErrorCodes.DATA_CONFLICT]: { retryAfter: 0, userAction: 'Resolve conflict' },
  
  [ErrorCodes.PERMISSION_DENIED]: { retryAfter: 0, userAction: 'Check permissions' },
  [ErrorCodes.INSUFFICIENT_TIER]: { retryAfter: 0, userAction: 'Upgrade plan' },
  
  [ErrorCodes.UNKNOWN_ERROR]: { retryAfter: 30, userAction: 'Retry' },
} as const;

/**
 * Create a standardized ChatError from various error sources
 */
export function createChatError(
  error: unknown,
  context: ErrorContext,
  fallbackCode: keyof typeof ErrorCodes = 'UNKNOWN_ERROR'
): ChatError {
  let code: keyof typeof ErrorCodes = fallbackCode;
  let message = '';
  let details = '';

  // Handle different error types
  if (error instanceof Error) {
    message = error.message;
    details = error.stack || '';
    
    // Try to map common error messages to error codes
    if (error.message.includes('daily limit')) {
      code = 'DAILY_LIMIT_EXCEEDED';
    } else if (error.message.includes('rate limit')) {
      code = 'RATE_LIMIT_EXCEEDED';
    } else if (error.message.includes('unauthorized')) {
      code = 'AUTH_REQUIRED';
    } else if (error.message.includes('forbidden')) {
      code = 'PERMISSION_DENIED';
    } else if (error.message.includes('not found')) {
      code = 'DATA_NOT_FOUND';
    } else if (error.message.includes('timeout')) {
      code = 'TIMEOUT_ERROR';
    } else if (error.message.includes('network')) {
      code = 'NETWORK_ERROR';
    }
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as any).message);
  } else {
    message = 'An unexpected error occurred';
  }

  // Get recovery strategy
  const recovery = RecoveryStrategies[code];
  
  return {
    code,
    message: ErrorMessages[code] || message,
    details: `${details}\nContext: ${JSON.stringify(context, null, 2)}`,
    recoverable: recovery.retryAfter > 0,
    retryAfter: recovery.retryAfter,
    userAction: recovery.userAction,
  };
}

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: ChatError): boolean {
  return error.recoverable;
}

/**
 * Get retry delay for an error
 */
export function getRetryDelay(error: ChatError): number {
  return error.retryAfter || 0;
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: ChatError): string {
  let formatted = error.message;
  
  if (error.userAction) {
    formatted += `\n\nAction: ${error.userAction}`;
  }
  
  if (error.retryAfter && error.retryAfter > 0) {
    const minutes = Math.ceil(error.retryAfter / 60);
    formatted += `\n\nRetry in: ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  return formatted;
}

/**
 * Log error with context for debugging
 */
export function logError(error: ChatError, context: ErrorContext): void {
  console.log({
    code: error.code,
    message: error.message,
    context,
    details: error.details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create a user-friendly error message
 */
export function getUserFriendlyMessage(error: ChatError): string {
  // For certain errors, provide more helpful messages
  switch (error.code) {
    case ErrorCodes.DAILY_LIMIT_EXCEEDED:
      return 'You\'ve reached your daily message limit. Upgrade to Pro for unlimited messages!';
    
    case ErrorCodes.INSUFFICIENT_TIER:
      return 'This feature requires a higher tier. Upgrade now to unlock advanced AI capabilities!';
    
    case ErrorCodes.AI_PROVIDER_UNAVAILABLE:
      return 'Our AI service is temporarily busy. Please try again in a moment.';
    
    case ErrorCodes.NETWORK_ERROR:
      return 'Connection issue detected. Please check your internet and try again.';
    
    default:
      return error.message;
  }
}
