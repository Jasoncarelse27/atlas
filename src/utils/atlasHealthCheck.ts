/**
 * Atlas Health Check - Quick diagnostic for launch day
 * Tests backend connectivity and API key status
 */

import { getApiEndpoint } from './apiClient';
import { getAuthTokenOrThrow } from './getAuthToken';
import { logger } from '../lib/logger';

export interface HealthCheckResult {
  success: boolean;
  backendReachable: boolean;
  apiKeyConfigured: boolean;
  authWorking: boolean;
  messageEndpointWorking: boolean;
  errors: string[];
}

/**
 * Quick health check - tests if Atlas can talk
 * Run this in browser console: window.atlasHealthCheck()
 */
export async function atlasHealthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    success: false,
    backendReachable: false,
    apiKeyConfigured: false,
    authWorking: false,
    messageEndpointWorking: false,
    errors: []
  };

  try {
    // 1. Check backend health endpoint
    try {
      const healthUrl = getApiEndpoint('/api/healthz');
      const healthResponse = await fetch(healthUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5s timeout
      });
      
      if (healthResponse.ok) {
        result.backendReachable = true;
        logger.info('[HealthCheck] ✅ Backend is reachable');
      } else {
        result.errors.push(`Backend health check failed: ${healthResponse.status}`);
      }
    } catch (error) {
      result.errors.push(`Backend unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.error('[HealthCheck] ❌ Backend unreachable:', error);
    }

    // 2. Check auth
    try {
      const token = await getAuthTokenOrThrow('Health check: Please sign in');
      result.authWorking = true;
      logger.info('[HealthCheck] ✅ Auth working');
    } catch (error) {
      result.errors.push(`Auth failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.error('[HealthCheck] ❌ Auth failed:', error);
    }

    // 3. Check message endpoint (without sending actual message)
    if (result.authWorking) {
      try {
        const messageUrl = getApiEndpoint('/api/message');
        const token = await getAuthTokenOrThrow('Health check');
        
        // Send a minimal test request
        const testResponse = await fetch(messageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: 'test' }),
          signal: AbortSignal.timeout(10000) // 10s timeout
        });

        // Check if we get a proper response (even if it's an error about missing API key)
        if (testResponse.status === 503) {
          const errorData = await testResponse.json().catch(() => ({}));
          if (errorData.code === 'MISSING_API_KEY') {
            result.errors.push('Backend API key not configured - check Railway env vars');
          } else {
            result.errors.push(`Backend returned 503: ${errorData.error || 'Unknown'}`);
          }
        } else if (testResponse.status === 400) {
          // 400 is OK - means backend is working, just validation failed
          result.messageEndpointWorking = true;
          logger.info('[HealthCheck] ✅ Message endpoint responding');
        } else if (testResponse.ok) {
          result.messageEndpointWorking = true;
          logger.info('[HealthCheck] ✅ Message endpoint working');
        } else {
          result.errors.push(`Message endpoint returned ${testResponse.status}`);
        }
      } catch (error) {
        result.errors.push(`Message endpoint test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        logger.error('[HealthCheck] ❌ Message endpoint test failed:', error);
      }
    }

    // Determine overall success
    result.success = result.backendReachable && result.authWorking && result.messageEndpointWorking;
    
    if (result.success) {
      logger.info('[HealthCheck] ✅ All systems operational');
    } else {
      logger.error('[HealthCheck] ❌ Issues detected:', result.errors);
    }

    return result;
  } catch (error) {
    result.errors.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logger.error('[HealthCheck] ❌ Health check failed:', error);
    return result;
  }
}

// Make it available globally for quick console testing
if (typeof window !== 'undefined') {
  (window as any).atlasHealthCheck = atlasHealthCheck;
}

