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

// Global navigation function storage (for use outside React components)
let globalNavigate: NavigateFunction | null = null;

/**
 * Set the global navigate function (called from App.tsx)
 * This allows utility functions to navigate without React hooks
 */
export function setGlobalNavigate(navigate: NavigateFunction): void {
  globalNavigate = navigate;
}

/**
 * Hook for safe internal navigation
 * Use this instead of window.location.href for internal routes
 */
export function useSafeNavigation() {
  const navigate = useNavigate();
  
  // Store navigate function globally for utility functions
  if (typeof window !== 'undefined') {
    (window as any).__atlasNavigate = navigate;
    setGlobalNavigate(navigate);
  }
  
  return {
    /**
     * Navigate to an internal route
     * @param path - Internal route path (e.g., '/login', '/chat')
     * @param replace - Replace current history entry (default: true)
     */
    goTo: (path: string, replace: boolean = true) => {
      navigate(path, { replace });
    },
    
    /**
     * Navigate back in history
     */
    goBack: () => {
      navigate(-1);
    },
    
    /**
     * Reload page (only for critical errors)
     * ⚠️ Use sparingly - prefer React Router navigation
     */
    reload: () => {
      window.location.reload();
    },
  };
}

/**
 * Programmatic navigation helper (for use outside React components)
 * ⚠️ Prefer useSafeNavigation hook when possible
 */
export function navigateTo(path: string, replace: boolean = true): void {
  // Try to use global navigate function first
  if (globalNavigate) {
    globalNavigate(path, { replace });
    return;
  }
  
  // Fallback: Try to get navigate from window (set by useSafeNavigation)
  if (typeof window !== 'undefined' && (window as any).__atlasNavigate) {
    (window as any).__atlasNavigate(path, { replace });
    return;
  }
  
  // Last resort: Use window.location (slower, but works)
  // ✅ PRODUCTION LOGGING: Use logger instead of console
  if (typeof window !== 'undefined' && (window as any).__atlasLogger) {
    (window as any).__atlasLogger.warn('[Navigation] Using window.location fallback - consider using useSafeNavigation hook');
  }
  window.location.href = path;
}

