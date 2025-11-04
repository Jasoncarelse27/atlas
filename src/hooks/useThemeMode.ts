import { useState, useEffect } from 'react';
import { useCustomization } from './useCustomization';

type ThemeMode = 'light' | 'dark' | 'auto';

export const useThemeMode = () => {
  const { customization, updateCustomization, saveCustomization } = useCustomization();
  // ✅ Default to dark theme (was showing light before)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    // Check localStorage first
    const saved = localStorage.getItem('atlas:theme');
    if (saved === 'dark' || saved === 'light') return saved as ThemeMode;
    // Default to dark
    return 'dark';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Initialize theme from customization or default to dark
  useEffect(() => {
    if (customization?.theme?.mode) {
      setThemeMode(customization.theme.mode);
    }
  }, [customization]);

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

  // Apply theme based on mode and system preference
  useEffect(() => {
    const shouldUseDarkMode = 
      themeMode === 'dark' ||
      (themeMode === 'auto' && systemPrefersDark);
    
    if (shouldUseDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light'); 
      document.documentElement.style.setProperty('--background-color', '#121212', 'important');
      document.documentElement.style.setProperty('--text-color', '#E5E7EB', 'important');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light'); 
      document.documentElement.style.setProperty('--background-color', '#F9FAFB', 'important');
      document.documentElement.style.setProperty('--text-color', '#1F2937', 'important');
    }
    
    // Force a repaint to ensure changes are applied
    const html = document.documentElement;
    const currentClass = html.className;
    html.className = currentClass + ' repaint';
    setTimeout(() => {
      html.className = currentClass;
    }, 1);
  }, [themeMode, systemPrefersDark]);

  // Function to toggle between light and dark
  const toggleTheme = () => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
    
    if (customization) {
      updateCustomization('theme.mode', newMode);
      saveCustomization();
    }
  };

  // Function to set a specific theme
  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    
    if (customization) {
      updateCustomization('theme.mode', mode);
      saveCustomization();
    }
  };

  return {
    themeMode,
    systemPrefersDark,
    toggleTheme,
    setTheme,
    isDarkMode: themeMode === 'dark' || (themeMode === 'auto' && systemPrefersDark)
  };
};

export default useThemeMode;
