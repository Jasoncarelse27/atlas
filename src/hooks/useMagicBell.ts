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

        // Backend disabled MagicBell → do not init
        if (response.status === 200) {
          const data = await response.json();
          if (data?.disabled || !data?.token) {
            logger.warn('[MagicBell] 🔕 Disabled or missing token (safe fallback)');
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
          console.log('[MagicBell] ✅ Initialized successfully');
          setIsLoading(false);
          return;
        }

        // 401 → Non-critical, swallow
        if (response.status === 401) {
          logger.warn('[MagicBell] 401 Unauthorized - treating as disabled');
          setError(null);
          setIsLoading(false);
          return;
        }

        logger.error('[MagicBell] Unexpected status:', response.status);
        setError(null);
        setIsLoading(false);
      } catch (err) {
        logger.debug('[NotificationCenter] Suppressed MagicBell error:', err);
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

