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
      if (!apiKey) {
        // Silent fallback - no error logging
        setError(null);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch user token from backend
        const tokenEndpoint = getApiEndpoint('/api/magicbell/token');
        
        let response: Response;
        try {
          response = await fetchWithAuth(tokenEndpoint, {
            method: 'GET',
          });
        } catch (fetchError) {
          // fetchWithAuth threw an error → treat as disabled (never throw)
          logger.debug('[MagicBell] Fetch error (safe fallback):', fetchError);
          setError(null);
          setIsLoading(false);
          return;
        }

        // Handle all response statuses gracefully
        if (response.status === 200) {
          let data: any = null;
          try {
            data = await response.json();
          } catch (parseError) {
            // JSON parse failed - backend might have returned non-JSON
            logger.debug('[MagicBell] Failed to parse response as JSON - treating as disabled');
            setError(null);
            setIsLoading(false);
            return;
          }
          
          // Backend disabled MagicBell → do not init
          if (data?.disabled || !data?.token) {
            logger.debug('[MagicBell] 🔕 Disabled or missing token (safe fallback)');
            setError(null);
            setIsLoading(false);
            return;
          }

          setConfig({
            apiKey,
            userToken: data.token,
            userEmail: user.email!,
            userId: user.id,
          });

          logger.debug('[MagicBell] ✅ Initialized successfully');
          setIsLoading(false);
          return;
        }

        // 401 → Non-critical, swallow
        if (response.status === 401) {
          logger.debug('[MagicBell] 401 Unauthorized - treating as disabled');
          setError(null);
          setIsLoading(false);
          return;
        }

        // Any other status → Non-critical, disable gracefully
        logger.debug('[MagicBell] Non-200 status:', response.status, '- treating as disabled');
        setError(null);
        setIsLoading(false);
      } catch (err) {
        // Any error → Non-critical, disable gracefully (never throw)
        logger.debug('[MagicBell] Suppressed error (safe fallback):', err);
        setError(null);
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

