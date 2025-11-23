import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../lib/logger';
import { useCustomization } from './useCustomization';
import { useSupabaseAuth } from './useSupabaseAuth';

type ThemeMode = 'light' | 'dark' | 'auto';

export const useThemeMode = () => {
  const { user } = useSupabaseAuth();
  const { customization, updateCustomization, saveCustomization } = useCustomization(user);
  
  // ✅ FIX: Track user-initiated changes to prevent overwrite loop
  const userInitiatedChangeRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  
  // ✅ SCALABILITY: Debounce timer for database saves (prevents rapid-fire writes)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingThemeRef = useRef<ThemeMode | null>(null);
  
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    // Check localStorage first
    const saved = localStorage.getItem('atlas:theme');
    if (saved === 'dark' || saved === 'light') return saved as ThemeMode;
    // Default to light
    return 'light';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // ✅ FIX: Only sync from customization on initial load, not on every change
  useEffect(() => {
    if (!customization?.theme?.mode) return;
    
    const localTheme = localStorage.getItem('atlas:theme') as ThemeMode;
    
    // 1️⃣ FIRST LOAD LOGIC - localStorage is source of truth
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      
      // Prefer localStorage over DB (user's last choice on this device)
      if (localTheme === 'light' || localTheme === 'dark') {
        setThemeMode(localTheme);
        return;
      }
      
      // No localStorage; use DB
      setThemeMode(customization.theme.mode);
      localStorage.setItem('atlas:theme', customization.theme.mode);
      return;
    }
    
    // 2️⃣ CROSS-DEVICE SYNC (only apply if safe)
    if (!userInitiatedChangeRef.current && customization.theme.mode !== themeMode) {
      // Only sync if localStorage matches DB (means it's a real cross-device sync)
      if (localTheme === customization.theme.mode) {
        // Safe to sync - localStorage confirms this is the correct value
        setThemeMode(customization.theme.mode);
      }
      // If localStorage differs from DB, localStorage wins (user's current session choice)
    }
  }, [customization?.theme?.mode, themeMode]); // Add themeMode to deps to prevent stale closures

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    
    // Add event listener with newer API if available
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // ✅ FIX: Apply theme class to DOM - IMMEDIATE and SYNCHRONOUS
  // ✅ CRITICAL: Apply synchronously to ensure it happens before any async operations
  useEffect(() => {
    const root = document.documentElement;
    const effectiveMode = themeMode === 'auto' 
      ? (systemPrefersDark ? 'dark' : 'light')
      : themeMode;
    
    // ✅ CRITICAL: Apply immediately and synchronously (no requestAnimationFrame delay)
    // Remove both classes, then add the correct one
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveMode);
    // ✅ CRITICAL: Also apply to body for better inheritance (mobile + web sync)
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(effectiveMode);
    
    // ✅ CRITICAL: Force multiple synchronous reflows to ensure browser applies the class
    void root.offsetHeight; // First reflow
    void document.body.offsetHeight; // Second reflow
    
    // ✅ VERIFY: Double-check the class was applied (critical for web browsers)
    const actualClass = root.classList.contains('dark') ? 'dark' : 
                       root.classList.contains('light') ? 'light' : null;
    if (actualClass !== effectiveMode) {
      logger.warn(`[ThemeMode] ⚠️ Theme class mismatch! Expected: ${effectiveMode}, Got: ${actualClass}, forcing...`);
      // Force correct class with multiple attempts
      root.classList.remove('light', 'dark');
      root.classList.add(effectiveMode);
      void root.offsetHeight;
      root.classList.remove('light', 'dark');
      root.classList.add(effectiveMode);
      void root.offsetHeight;
    }
    
    // ✅ DEBUG: Log DOM update for troubleshooting
    logger.debug(`[ThemeMode] 🎨 Applied theme to DOM: ${effectiveMode} (themeMode: ${themeMode}, verified: ${root.classList.contains(effectiveMode)})`);
  }, [themeMode, systemPrefersDark]);

  // ✅ SCALABILITY: Debounced save function (waits 1s after last toggle before saving)
  const debouncedSave = useCallback((mode: ThemeMode) => {
    // Clear any pending save
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Store the latest mode
    pendingThemeRef.current = mode;
    
    // Schedule save after 1 second of no toggles
    debounceTimerRef.current = setTimeout(() => {
      if (pendingThemeRef.current && customization) {
        updateCustomization('theme.mode', pendingThemeRef.current);
        saveCustomization();
        pendingThemeRef.current = null;
      }
    }, 1000);
  }, [customization, updateCustomization, saveCustomization]);

  // Function to toggle between light and dark
  const toggleTheme = useCallback(() => {
    // ✅ FIX: Calculate current effective mode (handles 'auto' mode correctly)
    const currentEffectiveMode = themeMode === 'auto' 
      ? (systemPrefersDark ? 'dark' : 'light')
      : themeMode;
    
    // ✅ FIX: Toggle based on effective mode, not just themeMode
    const newMode = currentEffectiveMode === 'light' ? 'dark' : 'light';
    
    logger.debug(`[ThemeMode] 🔄 Toggle clicked: ${themeMode} (effective: ${currentEffectiveMode}) → ${newMode}`);
    
    // ✅ FIX: Mark as user-initiated change FIRST (prevents useEffect from overwriting)
    userInitiatedChangeRef.current = true;
    
    // ✅ CRITICAL: Apply theme class IMMEDIATELY before state update (ensures instant visual feedback)
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newMode);
    // ✅ CRITICAL: Also apply to body for better inheritance (mobile + web sync)
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(newMode);
    
    // ✅ CRITICAL: Force multiple reflows to ensure browser applies the class
    void root.offsetHeight; // First reflow
    void document.body.offsetHeight; // Second reflow (ensures body sees the change)
    
    // ✅ VERIFY: Double-check the class was applied (critical for web browsers)
    if (!root.classList.contains(newMode)) {
      logger.warn(`[ThemeMode] ⚠️ Theme class not applied, forcing...`);
      root.classList.remove('light', 'dark');
      root.classList.add(newMode);
      void root.offsetHeight;
    }
    
    // ✅ CRITICAL FIX: Force CSS recalculation without visual flash
    // Trigger a repaint by reading a computed style property
    getComputedStyle(root).getPropertyValue('--atlas-bg');
    getComputedStyle(document.body).getPropertyValue('background-color');
    
    // ✅ IMMEDIATE UI UPDATE: Update state and localStorage instantly (no delay)
    // Use functional update to ensure we get the latest state
    setThemeMode((prevMode) => {
      // Double-check we're actually changing
      if (prevMode === newMode) {
        logger.warn(`[ThemeMode] ⚠️ Theme already ${newMode}, skipping state update`);
        return prevMode;
      }
      return newMode;
    });
    localStorage.setItem('atlas:theme', newMode);
    
    // ✅ CRITICAL FIX: Force React to re-render by dispatching a custom event
    // This ensures all components using isDarkMode get the new value immediately
    window.dispatchEvent(new Event('themechange'));
    
    // ✅ CRITICAL FIX: Force a synchronous re-render by triggering a state update
    // This ensures the toggle switch updates immediately
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('themechange'));
    });
    
    logger.debug(`[ThemeMode] ✅ State updated to ${newMode}, localStorage saved, DOM class applied and verified`);
    
    // ✅ SCALABILITY: Debounced database save (prevents rapid-fire writes at scale)
    // Only save if customization exists and DB value differs from new value
    if (customization) {
      if (customization.theme.mode === newMode) {
        logger.debug('[ThemeMode] ⏭️ Theme already set to', newMode, 'in DB - skipping DB save');
      } else {
        logger.debug('[ThemeMode] 💾 Scheduling debounced save to DB');
        debouncedSave(newMode);
      }
    } else {
      logger.debug('[ThemeMode] ⚠️ No customization loaded yet - will save when available');
    }
    
    // ✅ FIX: Reset flag after delay (allows cross-device sync after 3 seconds)
    setTimeout(() => {
      userInitiatedChangeRef.current = false;
    }, 2000);
  }, [themeMode, systemPrefersDark, customization, debouncedSave]);

  // Function to set a specific theme
  const setTheme = (mode: ThemeMode) => {
    // ✅ FIX: Mark as user-initiated change
    userInitiatedChangeRef.current = true;
    
    // ✅ IMMEDIATE UI UPDATE: Update state and localStorage instantly
    setThemeMode(mode);
    localStorage.setItem('atlas:theme', mode);
    
    // ✅ SCALABILITY: Debounced database save (prevents rapid-fire writes at scale)
    if (customization) {
      debouncedSave(mode);
    }
    
    // ✅ FIX: Reset flag after delay (allows cross-device sync after 2 seconds)
    setTimeout(() => {
      userInitiatedChangeRef.current = false;
    }, 2000);
  };
  
  // ✅ CLEANUP: Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // ✅ FIX: Compute isDarkMode reactively (updates immediately when themeMode changes)
  const isDarkMode = themeMode === 'dark' || (themeMode === 'auto' && systemPrefersDark);
  
  return {
    themeMode,
    systemPrefersDark,
    toggleTheme,
    setTheme,
    isDarkMode
  };
};

export default useThemeMode;
