import { useEffect, useState } from 'react';
import { MagicBellProvider } from '@magicbell/react';
import { useSupabaseAuth } from './useSupabaseAuth';
import { fetchWithAuth } from '../utils/authFetch';
import { getApiEndpoint } from '../utils/apiClient';
import { logger } from '../lib/logger';

interface MagicBellConfig {
  apiKey: string;
  userToken: string;
  userEmail: string;
  userId: string;
}

export function useMagicBell() {
  const { user } = useSupabaseAuth();
  const [config, setConfig] = useState<MagicBellConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initializeMagicBell() {
      if (!user?.id || !user?.email) {
        setIsLoading(false);
        return;
      }

      const apiKey = import.meta.env.VITE_MAGICBELL_API_KEY;
      console.log('[MagicBell] API Key check:', { 
        hasApiKey: !!apiKey, 
        apiKeyPrefix: apiKey?.substring(0, 10) || 'undefined' 
      });
      if (!apiKey) {
        const errorMsg = 'MagicBell API key not configured';
        logger.warn('[MagicBell]', errorMsg);
        console.error('[MagicBell]', errorMsg, '- Check VITE_MAGICBELL_API_KEY in .env');
        setError(errorMsg);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch user token from backend
        const tokenEndpoint = getApiEndpoint('/api/magicbell/token');
        
        const response = await fetchWithAuth(tokenEndpoint, {
          method: 'GET',
        });

        // ✅ FIX: Handle 401 gracefully (MagicBell is non-critical, don't break app)
        if (response.status === 401) {
          logger.warn('[MagicBell] 401 Unauthorized - token may be expired, skipping MagicBell initialization');
          setError(null); // Clear error - MagicBell is optional
          setIsLoading(false);
          return; // Exit gracefully without showing error to user
        }

        if (!response.ok) {
          // Only throw for non-401 errors
          throw new Error(`Failed to get MagicBell token: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success || !data.token) {
          throw new Error('Invalid response from MagicBell token endpoint');
        }

        setConfig({
          apiKey,
          userToken: data.token,
          userEmail: user.email!,
          userId: user.id,
        });

        logger.debug('[MagicBell] Initialized successfully');
        console.log('[MagicBell] ✅ Initialized successfully');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to initialize MagicBell';
        logger.error('[MagicBell] Failed to initialize:', err);
        console.error('[MagicBell] ❌ Failed to initialize:', errorMsg, err);
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    }

    initializeMagicBell();
  }, [user?.id, user?.email]);

  return {
    config,
    isLoading,
    error,
    isReady: !!config && !isLoading,
  };
}

