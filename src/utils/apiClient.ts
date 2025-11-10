import { logger } from '@/lib/logger';

/**
 * Centralized API Client Utility
 * 
 * Best Practice: Single source of truth for API URL resolution
 * - Production: Requires VITE_API_URL to be set (frontend/backend on different domains)
 * - Development: Uses relative URLs (Vite proxy handles routing)
 * 
 * Usage:
 *   import { getApiUrl } from '@/utils/apiClient';
 *   const response = await fetch(`${getApiUrl()}/api/message`, { ... });
 */

/**
 * Get the base API URL for all backend requests
 * 
 * @returns Base URL for API requests (includes protocol + domain, or empty string for relative)
 */
export function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  
  // ✅ CRITICAL FIX: Mixed content prevention - HTTPS frontend requires HTTPS backend
  if (apiUrl && typeof window !== 'undefined') {
    const isFrontendHttps = window.location.protocol === 'https:';
    const isBackendHttp = apiUrl.startsWith('http://');
    const isBackendHttps = apiUrl.startsWith('https://');
    
    // ✅ Detect local development environment (updated regex to include HTTPS)
    const isLocalDev = 
      import.meta.env.DEV || // Vite development mode
      /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|localhost|127\.0\.0\.1)/.test(apiUrl);
    
    // ✅ NEW: If backend is HTTPS in local dev, use it directly
    if (isFrontendHttps && isBackendHttps && isLocalDev) {
      logger.debug(
        '[API Client] ✅ Local HTTPS backend detected - using directly'
      );
      return apiUrl;
    }
    
    // ✅ EXISTING: Frontend HTTPS + backend HTTP → use Vite proxy (empty string)
    // This avoids browser mixed content blocking - Vite proxy handles HTTPS → HTTP internally
    if (isFrontendHttps && isBackendHttp && isLocalDev) {
      logger.debug(
        '[API Client] ℹ️ Local dev: Frontend HTTPS, backend HTTP. ' +
        'Using Vite proxy (relative URLs) to avoid mixed content blocking.'
      );
      return ''; // Return empty string to use Vite proxy
    }
    
    // Only upgrade HTTP to HTTPS in production (not local dev)
    if (isFrontendHttps && isBackendHttp && !isLocalDev) {
      logger.warn(
        '[API Client] ⚠️ Mixed content detected: Frontend HTTPS but backend HTTP. ' +
        'Upgrading backend URL to HTTPS automatically.'
      );
      apiUrl = apiUrl.replace('http://', 'https://');
    }
  }
  
  // Production check: If we're not in development and VITE_API_URL is not set, warn
  if (import.meta.env.PROD && !apiUrl) {
    logger.error(
      '[API Client] ⚠️ VITE_API_URL is not set in production! ' +
      'API calls will fail. Set VITE_API_URL in your environment variables.'
    );
  }
  
  return apiUrl;
}

/**
 * Build a full API endpoint URL
 * 
 * @param endpoint - API endpoint path (e.g., '/api/message' or 'api/message')
 * @returns Full URL for the endpoint
 * 
 * @example
 *   getApiEndpoint('/api/message') // Returns: 'https://backend.com/api/message' or '/api/message'
 *   getApiEndpoint('api/message')  // Returns: 'https://backend.com/api/message' or '/api/message'
 */
export function getApiEndpoint(endpoint: string): string {
  const baseUrl = getApiUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // If baseUrl is empty (development/relative), return endpoint as-is
  if (!baseUrl) {
    return normalizedEndpoint;
  }
  
  // Ensure baseUrl doesn't end with slash and endpoint starts with /
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  return `${cleanBaseUrl}${normalizedEndpoint}`;
}

/**
 * Check if we're in production environment
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * Check if API URL is configured
 */
export function isApiUrlConfigured(): boolean {
  return !!import.meta.env.VITE_API_URL;
}

