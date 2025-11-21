/**
 * Network Error Suppressor
 * 
 * Best practice: Handle network errors gracefully without polluting console
 * Note: Browser-level "Failed to load resource" errors cannot be suppressed
 * but we can prevent them by checking configuration before making requests
 */

import { logger } from '../lib/logger';

// Track known failing endpoints to avoid repeated attempts
const failingEndpoints = new Set<string>();
const endpointFailCounts = new Map<string, number>();

export function shouldAttemptRequest(url: string): boolean {
  // Check if this endpoint has failed too many times
  const failCount = endpointFailCounts.get(url) || 0;
  
  // After 3 consecutive failures, stop attempting for this session
  if (failCount >= 3) {
    logger.debug(`[NetworkErrorSuppressor] Skipping request to ${url} (failed ${failCount} times)`);
    return false;
  }
  
  // Check for MagicBell endpoints when API key is missing
  if (url.includes('api.magicbell.com') && !import.meta.env.VITE_MAGICBELL_API_KEY) {
    logger.debug('[NetworkErrorSuppressor] Skipping MagicBell request (no API key configured)');
    return false;
  }
  
  return true;
}

export function recordRequestFailure(url: string, status: number): void {
  const currentCount = endpointFailCounts.get(url) || 0;
  endpointFailCounts.set(url, currentCount + 1);
  
  if (status === 401 || status === 403) {
    failingEndpoints.add(url);
  }
  
  logger.debug(`[NetworkErrorSuppressor] Recorded failure for ${url} (count: ${currentCount + 1}, status: ${status})`);
}

export function recordRequestSuccess(url: string): void {
  // Reset failure count on success
  endpointFailCounts.delete(url);
  failingEndpoints.delete(url);
}

export function isEndpointFailing(url: string): boolean {
  return failingEndpoints.has(url);
}
