// ✅ CRITICAL FIX: Import from zustand/react to bypass re-export chain (fixes Vercel bundling)
import { create } from 'zustand/react';

interface SettingsState {
  theme: 'dark' | 'light';
  privacyMode: boolean;
  reduceMotion: boolean;
  increaseContrast: boolean;
  screenReader: boolean;
  
  toggleTheme: () => void;
  togglePrivacy: () => void;
  toggleReduceMotion: () => void;
  toggleIncreaseContrast: () => void;
  toggleScreenReader: () => void;
  
  // Initialize from localStorage
  initializeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  privacyMode: false,
  reduceMotion: false,
  increaseContrast: false,
  screenReader: false,
  
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

