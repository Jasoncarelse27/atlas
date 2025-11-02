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
  const apiUrl = import.meta.env.VITE_API_URL || '';
  
  // Production check: If we're not in development and VITE_API_URL is not set, warn
  if (import.meta.env.PROD && !apiUrl) {
    console.error(
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

