/**
 * Platform Detection Utility
 * Detects the current platform (iOS, Android, or Web) for payment routing
 */

export type Platform = 'ios' | 'android' | 'web';

/**
 * Detect if running on iOS device
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/i.test(userAgent);
}

/**
 * Detect if running on Android device
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  return /android/i.test(userAgent);
}

/**
 * Detect if running in native iOS app (Expo/React Native)
 */
export function isNativeIOS(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for React Native or Expo environment
  const isReactNative = typeof (window as any).ReactNativeWebView !== 'undefined' ||
                        typeof (window as any).webkit?.messageHandlers !== 'undefined';
  
  // Check for Expo
  const isExpo = typeof (window as any).Expo !== 'undefined';
  
  return isIOS() && (isReactNative || isExpo);
}

/**
 * Detect if running in native Android app
 */
export function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  
  const isReactNative = typeof (window as any).ReactNativeWebView !== 'undefined';
  
  return isAndroid() && isReactNative;
}

/**
 * Get current platform
 */
export function getPlatform(): Platform {
  if (isNativeIOS() || isIOS()) {
    return 'ios';
  }
  
  if (isNativeAndroid() || isAndroid()) {
    return 'android';
  }
  
  return 'web';
}

/**
 * Check if platform requires in-app purchases
 */
export function requiresIAP(): boolean {
  const platform = getPlatform();
  return platform === 'ios' || platform === 'android';
}

