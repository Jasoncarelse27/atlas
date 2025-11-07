/**
 * ✅ ANDROID BEST PRACTICE: Handle Android hardware/software back button
 * 
 * Prevents accidental app exit and provides consistent navigation UX
 * Follows Material Design guidelines for back button behavior
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../lib/logger';

/**
 * Hook to handle Android back button navigation
 * 
 * Features:
 * - Prevents accidental app exit on first back press
 * - Navigates back through app history
 * - Works with browser back button and Android hardware back button
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useAndroidBackButton();
 *   return <div>Content</div>;
 * }
 * ```
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Detect if we're on Android
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid) {
      // Only apply on Android devices
      return;
    }

    // Track if we've pushed a state to prevent exit
    let hasPushedState = false;

    const handleBackButton = (e: PopStateEvent) => {
      logger.debug('[AndroidBackButton] Back button pressed');

      // If we have history, navigate back
      if (window.history.length > 1 && hasPushedState) {
        navigate(-1);
      } else {
        // Prevent app exit on first back press
        // Push a state so we can detect subsequent presses
        window.history.pushState(null, '', window.location.href);
        hasPushedState = true;
        
        // Show toast or handle first back press
        logger.debug('[AndroidBackButton] Prevented app exit, pushed state');
      }
    };

    // Push initial state to track back button presses
    window.history.pushState(null, '', window.location.href);
    hasPushedState = true;

    // Listen for back button (works for both browser and Android hardware button)
    window.addEventListener('popstate', handleBackButton);

    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [navigate, location]);
}

