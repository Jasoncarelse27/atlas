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
  
  // ✅ MOBILE FIX: If VITE_API_URL is empty and we're accessing from a network IP (mobile),
  // construct the backend URL from the current hostname with port 8000
  if (!apiUrl && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Check if we're accessing from a network IP (not localhost)
    const isNetworkIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(hostname);
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    
    // If accessing from network IP (mobile device), use backend directly on port 8000
    if (isNetworkIP && import.meta.env.DEV) {
      // ✅ BEST PRACTICE: Match frontend protocol to prevent mixed content blocking
      // HTTPS frontend MUST use HTTPS backend (browsers block HTTP from HTTPS)
      // Backend runs HTTPS on port 8000, so use same protocol as frontend
      const backendProtocol = window.location.protocol === 'https:' ? 'https' : 'http';
      const backendUrl = `${backendProtocol}://${hostname}:8000`;
      logger.debug(
        `[API Client] 📱 Mobile/Network access detected (${hostname}). ` +
        `Using backend URL: ${backendUrl} (protocol matches frontend: ${window.location.protocol})`
      );
      return backendUrl;
    }
    
    // If localhost, use relative URLs (Vite proxy handles it)
    if (isLocalhost) {
      logger.debug(
        '[API Client] 💻 Localhost access - using relative URLs (Vite proxy)'
      );
      return ''; // Return empty string to use Vite proxy
    }
  }
  
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
    
    // ✅ CRITICAL FIX: Frontend HTTPS + backend HTTP → upgrade to HTTPS
    // Mixed content blocking prevents HTTPS pages from loading HTTP resources
    // Backend runs HTTPS on port 8000, so upgrade HTTP to HTTPS
    if (isFrontendHttps && isBackendHttp && isLocalDev) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      // If localhost, try Vite proxy first (but it may not work with HTTPS frontend)
      if (isLocalhost) {
        logger.debug(
          '[API Client] ℹ️ Local dev: Frontend HTTPS, backend HTTP. ' +
          'Trying Vite proxy first, but may need HTTPS backend.'
        );
        // Still upgrade to HTTPS for consistency (backend supports HTTPS)
        apiUrl = apiUrl.replace('http://', 'https://');
      } else {
        // Network IP: Must upgrade HTTP to HTTPS (no proxy available)
        logger.warn(
          '[API Client] ⚠️ Mixed content fix: Frontend HTTPS, backend HTTP. ' +
          'Upgrading backend URL to HTTPS to prevent mixed content blocking.'
        );
        apiUrl = apiUrl.replace('http://', 'https://');
      }
    }
    
    // ✅ PRODUCTION: Also upgrade HTTP to HTTPS in production
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

