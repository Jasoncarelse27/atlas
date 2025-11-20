// src/hooks/useTierRefreshOnFocus.ts
// Hook to refresh tier when app becomes visible or receives focus
// Ensures tier is always up-to-date across devices and after upgrades

import { useEffect, useRef } from 'react';
import { useTierQuery } from './useTierQuery';
import { logger } from '../lib/logger';

/**
 * Hook to automatically refresh tier when app becomes visible or receives focus
 * 
 * This ensures:
 * - Cross-device sync (upgrade on web → mobile sees it when opened)
 * - Tier updates after returning from background
 * - Fresh tier data on app boot
 * 
 * Safe to use in multiple components - uses cooldown to prevent excessive refreshes
 */
export function useTierRefreshOnFocus() {
  const { refreshTier } = useTierQuery();
  
  // Cooldown to prevent excessive refreshes (10 seconds minimum between refreshes)
  const lastRefreshRef = useRef<number>(0);
  const REFRESH_COOLDOWN = 10000; // 10 seconds

  useEffect(() => {
    // Initial refresh on mount (only if app is visible)
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      const now = Date.now();
      if (now - lastRefreshRef.current > REFRESH_COOLDOWN) {
        lastRefreshRef.current = now;
        refreshTier().catch((err) => {
          // Silent fail - non-critical
          logger.debug('[TierRefresh] Initial refresh failed:', err);
        });
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        // Only refresh if cooldown has passed
        if (now - lastRefreshRef.current > REFRESH_COOLDOWN) {
          lastRefreshRef.current = now;
          refreshTier().catch((err) => {
            // Silent fail - non-critical
            logger.debug('[TierRefresh] Visibility refresh failed:', err);
          });
        }
      }
    };

    const handleFocus = () => {
      const now = Date.now();
      // Only refresh if cooldown has passed
      if (now - lastRefreshRef.current > REFRESH_COOLDOWN) {
        lastRefreshRef.current = now;
        refreshTier().catch((err) => {
          // Silent fail - non-critical
          logger.debug('[TierRefresh] Focus refresh failed:', err);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshTier]);
}

