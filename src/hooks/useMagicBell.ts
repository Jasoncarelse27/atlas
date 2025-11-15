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
        logger.warn('[MagicBell] API key not configured');
        setError('MagicBell API key not configured');
        setIsLoading(false);
        return;
      }

      try {
        // Fetch user token from backend
        const tokenEndpoint = getApiEndpoint('/api/magicbell/token');
        
        const response = await fetchWithAuth(tokenEndpoint, {
          method: 'GET',
        });

        if (!response.ok) {
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
      } catch (err) {
        logger.error('[MagicBell] Failed to initialize:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize MagicBell');
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

