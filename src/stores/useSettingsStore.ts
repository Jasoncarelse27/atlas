// ✅ PRODUCTION-SAFE: Import from wrapper to prevent Vercel bundling issues
import { create } from '@/lib/zustand-wrapper';

interface SettingsState {
  // ⚠️ DEPRECATED: Theme is now managed by useThemeMode hook
  // Keeping for backwards compatibility - DO NOT USE
  theme: 'dark' | 'light';
  privacyMode: boolean;
  reduceMotion: boolean;
  increaseContrast: boolean;
  screenReader: boolean;
  
  // ⚠️ DEPRECATED: Use useThemeMode().toggleTheme() instead
  toggleTheme: () => void;
  togglePrivacy: () => void;
  toggleReduceMotion: () => void;
  toggleIncreaseContrast: () => void;
  toggleScreenReader: () => void;
  
  // Initialize from localStorage
  initializeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark', // ⚠️ DEPRECATED - kept for compatibility
  privacyMode: false,
  reduceMotion: false,
  increaseContrast: false,
  screenReader: false,
  
  // ⚠️ DEPRECATED: This no longer syncs with DOM or database
  // Use useThemeMode().toggleTheme() instead
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('atlas:theme', newTheme);
    return { theme: newTheme };
  }),
  
  togglePrivacy: () => set((state) => {
    const newValue = !state.privacyMode;
    localStorage.setItem('atlas:privacyMode', JSON.stringify(newValue));
    return { privacyMode: newValue };
  }),
  
  toggleReduceMotion: () => set((state) => {
    const newValue = !state.reduceMotion;
    localStorage.setItem('atlas:reduceMotion', JSON.stringify(newValue));
    return { reduceMotion: newValue };
  }),
  
  toggleIncreaseContrast: () => set((state) => {
    const newValue = !state.increaseContrast;
    localStorage.setItem('atlas:increaseContrast', JSON.stringify(newValue));
    return { increaseContrast: newValue };
  }),
  
  toggleScreenReader: () => set((state) => {
    const newValue = !state.screenReader;
    localStorage.setItem('atlas:screenReader', JSON.stringify(newValue));
    return { screenReader: newValue };
  }),
  
  initializeSettings: () => {
    const theme = (localStorage.getItem('atlas:theme') as 'dark' | 'light') || 'dark';
    const privacyMode = JSON.parse(localStorage.getItem('atlas:privacyMode') || 'false');
    const reduceMotion = JSON.parse(localStorage.getItem('atlas:reduceMotion') || 'false');
    const increaseContrast = JSON.parse(localStorage.getItem('atlas:increaseContrast') || 'false');
    const screenReader = JSON.parse(localStorage.getItem('atlas:screenReader') || 'false');
    
    set({ theme, privacyMode, reduceMotion, increaseContrast, screenReader });
  },
}));

