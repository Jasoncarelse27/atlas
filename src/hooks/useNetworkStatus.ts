import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isReconnecting: boolean;
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  lastSeen?: Date;
  latency?: number;
}

export interface NetworkStatusOptions {
  checkInterval?: number; // How often to check network status (ms)
  timeout?: number; // Timeout for network checks (ms)
  retryAttempts?: number; // Number of retry attempts before marking offline
}

/**
 * Hook for monitoring network connectivity status
 * Provides real-time network information and offline detection
 */
export function useNetworkStatus(options: NetworkStatusOptions = {}): NetworkStatus {
  const {
    checkInterval = 5000, // Check every 5 seconds
    timeout = 3000, // 3 second timeout
    retryAttempts = 2, // 2 retry attempts
  } = options;

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isReconnecting: false,
    connectionType: 'unknown',
  });

  const [retryCount, setRetryCount] = useState(0);

  // Check network connectivity with a ping test
  const checkNetworkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      // Try to fetch a small resource to test connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const startTime = Date.now();
      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        setNetworkStatus(prev => ({
          ...prev,
          isOnline: true,
          isReconnecting: false,
          latency,
          lastSeen: new Date(),
        }));
        setRetryCount(0);
        return true;
      }

      return false;
    } catch (error) {
      // Network error or timeout
      return false;
    }
  }, [timeout]);

  // Handle online/offline events
  const handleOnline = useCallback(() => {
    setNetworkStatus(prev => ({
      ...prev,
      isOnline: true,
      isReconnecting: false,
      lastSeen: new Date(),
    }));
    setRetryCount(0);
  }, []);

  const handleOffline = useCallback(() => {
    setNetworkStatus(prev => ({
      ...prev,
      isOnline: false,
      isReconnecting: false,
    }));
  }, []);

  // Periodic network check
  useEffect(() => {
    if (!navigator.onLine) {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        isReconnecting: false,
      }));
      return;
    }

    const checkNetwork = async () => {
      const isConnected = await checkNetworkConnectivity();
      
      if (!isConnected) {
        setRetryCount(prev => prev + 1);
        
        if (retryCount >= retryAttempts) {
          setNetworkStatus(prev => ({
            ...prev,
            isOnline: false,
            isReconnecting: true,
          }));
        }
      }
    };

    // Initial check
    checkNetwork();

    // Set up periodic checking
    const intervalId = setInterval(checkNetwork, checkInterval);

    return () => clearInterval(intervalId);
  }, [checkInterval, retryCount, retryAttempts, checkNetworkConnectivity]);

  // Listen for browser online/offline events
  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Detect connection type if available
  useEffect(() => {
    const detectConnectionType = () => {
      // Check if the Network Information API is available
      if ('connection' in navigator && (navigator as any).connection) {
        const connection = (navigator as any).connection;
        let connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown' = 'unknown';

        if (connection.effectiveType) {
          switch (connection.effectiveType) {
            case 'slow-2g':
            case '2g':
            case '3g':
            case '4g':
              connectionType = 'cellular';
              break;
            case 'wifi':
              connectionType = 'wifi';
              break;
            case 'ethernet':
              connectionType = 'ethernet';
              break;
            default:
              connectionType = 'unknown';
          }
        }

        setNetworkStatus(prev => ({
          ...prev,
          connectionType,
        }));
      }
    };

    detectConnectionType();
  }, []);

  // Manual network check function
  const checkNetwork = useCallback(async () => {
    setNetworkStatus(prev => ({
      ...prev,
      isReconnecting: true,
    }));

    const isConnected = await checkNetworkConnectivity();
    
    if (isConnected) {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: true,
        isReconnecting: false,
      }));
    } else {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        isReconnecting: false,
      }));
    }
  }, [checkNetworkConnectivity]);

  return {
    ...networkStatus,
    checkNetwork, // Expose manual check function
  };
}

/**
 * Hook for simple online/offline status
 */
export function useOnlineStatus(): boolean {
  const { isOnline } = useNetworkStatus();
  return isOnline;
}

/**
 * Hook for network reconnection status
 */
export function useReconnectionStatus(): boolean {
  const { isReconnecting } = useNetworkStatus();
  return isReconnecting;
}

/**
 * Hook for network latency monitoring
 */
export function useNetworkLatency(): number | undefined {
  const { latency } = useNetworkStatus();
  return latency;
}
