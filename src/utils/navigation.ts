/**
 * Safe Navigation Utility for React Router
 * 
 * ✅ BEST PRACTICE: Use React Router navigation instead of window.location
 * - Preserves React state
 * - Faster navigation (no full page reload)
 * - Better mobile UX
 * 
 * ⚠️ EXCEPTIONS: Keep window.location for:
 * - External URLs (FastSpring checkout, etc.)
 * - Critical error recovery (error boundaries)
 * - Cache clearing (main.tsx version check)
 */

import type { NavigateFunction } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { logger } from '../lib/logger';
import { toast } from 'sonner';

// Global navigation function storage (for use outside React components)
let globalNavigate: NavigateFunction | null = null;

// Track if we're in the middle of navigation to prevent double navigations
let isNavigating = false;

/**
 * Set the global navigate function (called from App.tsx)
 * This allows utility functions to navigate without React hooks
 */
export function setGlobalNavigate(navigate: NavigateFunction): void {
  globalNavigate = navigate;
  
  // Also store in window for emergency fallback
  if (typeof window !== 'undefined') {
    (window as any).__atlasNavigate = navigate;
  }
}

/**
 * Hook for safe internal navigation
 * Use this instead of window.location.href for internal routes
 */
export function useSafeNavigation() {
  const navigate = useNavigate();
  
  // Store navigate function globally for utility functions
  if (typeof window !== 'undefined' && !globalNavigate) {
    setGlobalNavigate(navigate);
  }
  
  return {
    /**
     * Navigate to an internal route
     * @param path - Internal route path (e.g., '/login', '/chat')
     * @param options - Navigation options
     */
    goTo: (path: string, options?: { replace?: boolean; state?: any }) => {
      if (isNavigating) {
        logger.debug('[Navigation] Navigation already in progress, ignoring');
        return;
      }
      
      isNavigating = true;
      navigate(path, options);
      
      // Reset navigation flag after a short delay
      setTimeout(() => { isNavigating = false; }, 100);
    },
    
    /**
     * Navigate to a new chat conversation
     * @param conversationId - The conversation ID to navigate to
     */
    goToChat: (conversationId?: string) => {
      const path = conversationId ? `/chat?conversation=${conversationId}` : '/chat';
      navigate(path, { replace: true });
    },
    
    /**
     * Navigate back in history
     */
    goBack: () => {
      navigate(-1);
    },
    
    /**
     * Refresh current route (preserves state)
     */
    refresh: () => {
      navigate(0);
    },
    
    /**
     * Open external URL
     * @param url - External URL to open
     */
    openExternal: (url: string) => {
      window.location.href = url;
    },
    
    /**
     * Reload page (only for critical errors)
     * ⚠️ Use sparingly - prefer refresh() or state updates
     */
    hardReload: () => {
      window.location.reload();
    },
  };
}

/**
 * Programmatic navigation helper (for use outside React components)
 * ⚠️ Prefer useSafeNavigation hook when possible
 */
export function navigateTo(path: string, options?: { replace?: boolean; state?: any }): void {
  // Prevent double navigation
  if (isNavigating) {
    logger.debug('[Navigation] Navigation already in progress, ignoring');
    return;
  }
  
  // Try to use global navigate function first
  if (globalNavigate) {
    isNavigating = true;
    globalNavigate(path, options);
    setTimeout(() => { isNavigating = false; }, 100);
    return;
  }
  
  // Fallback: Try to get navigate from window (set by useSafeNavigation)
  if (typeof window !== 'undefined' && (window as any).__atlasNavigate) {
    isNavigating = true;
    (window as any).__atlasNavigate(path, options);
    setTimeout(() => { isNavigating = false; }, 100);
    return;
  }
  
  // Last resort: Use window.location (slower, but works)
  logger.warn('[Navigation] Using window.location fallback - navigation not initialized');
  window.location.href = path;
}

/**
 * Navigate to login page
 * Commonly used throughout the app
 */
export function goToLogin(message?: string): void {
  if (message) {
    toast.info(message);
  }
  navigateTo('/login', { replace: true });
}

/**
 * Navigate to a new chat
 */
export function goToNewChat(): void {
  navigateTo('/chat', { replace: true });
}

/**
 * Navigate to a specific conversation
 */
export function goToConversation(conversationId: string): void {
  navigateTo(`/chat?conversation=${conversationId}`, { replace: true });
}

/**
 * Refresh current page (React Router way)
 * This preserves state unlike window.location.reload()
 */
export function refreshPage(): void {
  if (globalNavigate) {
    globalNavigate(0);
  } else {
    // Fallback to hard reload if navigate not available
    window.location.reload();
  }
}

/**
 * Check if URL is external
 */
export function isExternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url, window.location.origin);
    return urlObj.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Safe navigation that handles both internal and external URLs
 */
export function safeNavigate(url: string, options?: { replace?: boolean }): void {
  if (isExternalUrl(url)) {
    window.location.href = url;
  } else {
    navigateTo(url, options);
  }
}

