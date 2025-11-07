/**
 * ✅ ANDROID BEST PRACTICE: Handle Android virtual keyboard
 * 
 * Android Chrome has different keyboard behavior than iOS Safari.
 * This hook adjusts viewport and layout when keyboard appears/disappears.
 */

import { useEffect, useState } from 'react';
import { logger } from '../lib/logger';

interface AndroidKeyboardState {
  isOpen: boolean;
  height: number;
}

/**
 * Hook to detect and handle Android virtual keyboard
 * 
 * Features:
 * - Detects keyboard open/close state
 * - Calculates keyboard height
 * - Adjusts viewport dynamically
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOpen, height } = useAndroidKeyboard();
 *   
 *   return (
 *     <div style={{ paddingBottom: isOpen ? `${height}px` : '0' }}>
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useAndroidKeyboard(): AndroidKeyboardState {
  const [keyboardState, setKeyboardState] = useState<AndroidKeyboardState>({
    isOpen: false,
    height: 0,
  });

  useEffect(() => {
    // Detect if we're on Android
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid) {
      // Only apply on Android devices
      return;
    }

    // Check if visualViewport API is available (Android Chrome 61+)
    if (!window.visualViewport) {
      logger.debug('[AndroidKeyboard] visualViewport API not available');
      return;
    }

    const handleResize = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;

      const viewportHeight = viewport.height;
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - viewportHeight;

      // Keyboard is considered open if height difference > 150px
      // (accounts for browser chrome, not just keyboard)
      const isOpen = keyboardHeight > 150;

      setKeyboardState({
        isOpen,
        height: isOpen ? keyboardHeight : 0,
      });

      logger.debug('[AndroidKeyboard] State updated:', {
        isOpen,
        height: keyboardHeight,
        viewportHeight,
        windowHeight,
      });
    };

    // Listen for viewport resize (keyboard open/close)
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);

    // Initial check
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  return keyboardState;
}

