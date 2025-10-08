import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UserCustomization {
  id: string;
  user_id: string;
  theme: {
    mode: 'light' | 'dark' | 'auto';
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    borderRadius: number;
    fontSize: number;
    fontFamily: string;
  };
  layout: {
    sidebarPosition: 'left' | 'right' | 'hidden';
    headerStyle: 'minimal' | 'standard' | 'expanded';
    widgetLayout: 'grid' | 'list' | 'masonry';
    compactMode: boolean;
    showAnimations: boolean;
  };
  preferences: {
    language: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
    autoSave: boolean;
    notifications: boolean;
    soundEffects: boolean;
    keyboardShortcuts: boolean;
    accessibility: {
      highContrast: boolean;
      largeText: boolean;
      reduceMotion: boolean;
      screenReader: boolean;
    };
  };
  dashboard: {
    widgets: string[];
    layout: Record<string, { x: number; y: number; w: number; h: number }>;
    pinnedItems: string[];
    recentItems: string[];
  };
  created_at: string;
  updated_at: string;
}

interface UseCustomizationReturn {
  customization: UserCustomization | null;
  isLoading: boolean;
  error: string | null;
  updateCustomization: (path: string, value: any, preview?: boolean) => void;
  updateThemeColors: (primaryColor: string, accentColor: string, preview?: boolean) => void;
  saveCustomization: () => Promise<void>;
  resetToDefaults: () => void;
  refreshCustomization: () => Promise<void>;
  hasUnsavedChanges: boolean;
}

// Helper function to deep clone objects
type AnyObject = Record<string, unknown>;
const deepClone = (obj: unknown): unknown => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(item => deepClone(item));
  
  const cloned: AnyObject = {};
  for (const key in obj as AnyObject) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as AnyObject)[key]);
    }
  }
  return cloned;
};

// Helper function to convert hex to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 59, g: 130, b: 246 };
};

// Function to apply customization to the DOM
const applyCustomization = (custom: UserCustomization) => {
  
  const root = document.documentElement;
  
  // Apply CSS custom properties for theme
  root.style.setProperty('--primary-color', custom.theme.primaryColor);
  root.style.setProperty('--accent-color', custom.theme.accentColor);
  root.style.setProperty('--background-color', custom.theme.backgroundColor);
  root.style.setProperty('--text-color', custom.theme.textColor);
  root.style.setProperty('--border-radius', `${custom.theme.borderRadius}px`);
  root.style.setProperty('--font-size', `${custom.theme.fontSize}px`);
  root.style.setProperty('--font-family', custom.theme.fontFamily);

  // Set RGB values for shadows and other effects
  const primaryRgb = hexToRgb(custom.theme.primaryColor);
  const accentRgb = hexToRgb(custom.theme.accentColor);
  root.style.setProperty('--primary-color-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
  root.style.setProperty('--accent-color-rgb', `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);

  // Apply theme mode
  if (custom.theme.mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (custom.theme.mode === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    // Auto mode - detect system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  // Apply layout settings
  if (custom.layout.compactMode) {
    document.documentElement.classList.add('compact-mode');
  } else {
    document.documentElement.classList.remove('compact-mode');
  }

  // Apply accessibility settings
  if (custom.preferences.accessibility.reduceMotion || !custom.layout.showAnimations) {
    root.style.setProperty('--animation-duration', '0s');
    document.documentElement.classList.add('reduce-motion');
  } else {
    root.style.setProperty('--animation-duration', '0.3s');
    document.documentElement.classList.remove('reduce-motion');
  }

  if (custom.preferences.accessibility.largeText) {
    root.style.setProperty('--font-size-multiplier', '1.2');
    document.documentElement.classList.add('large-text');
  } else {
    root.style.setProperty('--font-size-multiplier', '1');
    document.documentElement.classList.remove('large-text');
  }

  if (custom.preferences.accessibility.highContrast) {
    document.documentElement.classList.add('high-contrast');
  } else {
    document.documentElement.classList.remove('high-contrast');
  }

  // Force a repaint to ensure changes are applied
  document.body.style.display = 'none';
  document.body.offsetHeight; // Trigger reflow
  document.body.style.display = '';

  console.log('✅ Customization applied to DOM');
};

// Helper function to safely attempt database operations
const safeDbOperation = async <T>(operation: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || 
          error.message.includes('NetworkError') ||
          error.message.includes('TypeError: Failed to fetch')) {
        return fallback;
      }
    }
    throw error; // Re-throw non-network errors
  }
};

// Helper function to compare objects deeply
const isEqual = (obj1: unknown, obj2: unknown): boolean => {
  if (obj1 === obj2) return true;
  if (obj1 === null || obj2 === null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;
  
  const keys1 = Object.keys(obj1 as AnyObject);
  const keys2 = Object.keys(obj2 as AnyObject);
  
  if (keys1.length !== keys2.length) {
    return false;
  }
  
  for (const key of keys1) {
    if (!keys2.includes(key)) {
      return false;
    }
    if (!isEqual((obj1 as AnyObject)[key], (obj2 as AnyObject)[key])) {
      return false;
    }
  }
  
  return true;
};

// Create default customization
const createDefaultCustomization = (userId: string): UserCustomization => ({
  id: `custom-${Date.now()}`,
  user_id: userId,
  theme: {
    mode: 'light',
    primaryColor: '#3B82F6',
    accentColor: '#10B981',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'Inter, system-ui, sans-serif'
  },
  layout: {
    sidebarPosition: 'left',
    headerStyle: 'standard',
    widgetLayout: 'grid',
    compactMode: false,
    showAnimations: true
  },
  preferences: {
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'MM/DD/YYYY',
    numberFormat: 'en-US',
    autoSave: true,
    notifications: true,
    soundEffects: true,
    keyboardShortcuts: true,
    accessibility: {
      highContrast: false,
      largeText: false,
      reduceMotion: false,
      screenReader: false
    }
  },
  dashboard: {
    widgets: ['usage-stats', 'quick-actions', 'conversation-history'],
    layout: {},
    pinnedItems: [],
    recentItems: []
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

export const useCustomization = (user: User | null): UseCustomizationReturn => {
  const [customization, setCustomization] = useState<UserCustomization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalCustomization, setOriginalCustomization] = useState<UserCustomization | null>(null);

  // Load customization from database or localStorage
  const loadCustomization = useCallback(async () => {
    if (!user) {
      setCustomization(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      
      // Try to load from database first with network error handling
      const dbResult = await safeDbOperation(
        async () => {
          const { data, error: dbError } = await supabase
            .from('user_customizations')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (dbError && dbError.code !== 'PGRST116') {
            throw new Error(`Database error: ${dbError.message}`);
          }

          return { data, error: dbError };
        },
        { data: null, error: { code: 'NETWORK_ERROR', message: 'Network unavailable' } }
      );

      // Fallback to localStorage
      const localData = localStorage.getItem(`atlas-customization-${user.id}`);
      
      let loadedCustomization: UserCustomization;

      if (dbResult.data && !dbResult.error) {
        console.log('✅ Loaded customization from database:', dbResult.data);
        loadedCustomization = dbResult.data;
      } else if (localData) {
        console.log('✅ Loaded customization from localStorage (database unavailable)');
        loadedCustomization = JSON.parse(localData);
        
        // Set a non-blocking error message for database unavailability
        if (dbResult.error?.code === 'NETWORK_ERROR') {
          setError('Running in offline mode - customization changes will be saved locally only');
        }
      } else {
        loadedCustomization = createDefaultCustomization(user.id);
        
        // Set a non-blocking error message for database unavailability
        if (dbResult.error?.code === 'NETWORK_ERROR') {
          setError('Running in offline mode - customization changes will be saved locally only');
        }
      }

      setCustomization(loadedCustomization);
      
      const clonedOriginal = deepClone(loadedCustomization) as UserCustomization;
      setOriginalCustomization(clonedOriginal);
      
      // Apply customization immediately
      setTimeout(() => {
        applyCustomization(loadedCustomization);
      }, 100);
      
      setHasUnsavedChanges(false);
    } catch (err) {
      
      // Check if it's a network error
      if (err instanceof Error && (
        err.message.includes('Failed to fetch') || 
        err.message.includes('NetworkError') ||
        err.message.includes('TypeError: Failed to fetch')
      )) {
        setError('Running in offline mode - customization changes will be saved locally only');
        
        // Try to load from localStorage as fallback
        const localData = localStorage.getItem(`atlas-customization-${user.id}`);
        let fallbackCustomization: UserCustomization;
        
        if (localData) {
          console.log('✅ Using localStorage fallback due to network error');
          fallbackCustomization = JSON.parse(localData);
        } else {
          fallbackCustomization = createDefaultCustomization(user.id);
        }
        
        setCustomization(fallbackCustomization);
        setOriginalCustomization(deepClone(fallbackCustomization) as UserCustomization);
        applyCustomization(fallbackCustomization);
      } else {
        setError('Failed to load your customization settings');
        // Use default customization
        const defaultCustomization = createDefaultCustomization(user.id);
        setCustomization(defaultCustomization);
        setOriginalCustomization(deepClone(defaultCustomization) as UserCustomization);
        applyCustomization(defaultCustomization);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Save customization to database and localStorage
  const saveCustomization = useCallback(async () => {
    if (!customization || !user) return;

    setIsLoading(true);
    setError(null);

    try {
      const updatedCustomization = {
        ...customization,
        user_id: user.id, // Ensure user_id is always set correctly
        updated_at: new Date().toISOString()
      };


      // Save to localStorage first (always works)
      localStorage.setItem(`atlas-customization-${user.id}`, JSON.stringify(updatedCustomization));

      // Try to save to database with network error handling
      await safeDbOperation(
        async () => {
          const { error: dbError } = await supabase
            .from('user_customizations')
            .upsert([updatedCustomization], { onConflict: 'user_id' });

          if (dbError) {
            throw new Error(`Database save failed: ${dbError.message}`);
          }

          console.log('✅ Saved to database successfully');
          return true;
        },
        false // Fallback value for network errors
      ).catch((dbErr) => {
        if (dbErr.message.includes('Failed to fetch') || 
            dbErr.message.includes('NetworkError') ||
            dbErr.message.includes('TypeError: Failed to fetch')) {
          setError('Running in offline mode - customization saved locally only');
        } else {
          setError('Failed to sync customization to cloud, but saved locally');
        }
      });

      setCustomization(updatedCustomization);
      const clonedUpdated = deepClone(updatedCustomization) as UserCustomization;
      setOriginalCustomization(clonedUpdated);
      applyCustomization(updatedCustomization);
      setHasUnsavedChanges(false);
      
    } catch (err) {
      if (err instanceof Error && (
        err.message.includes('Failed to fetch') || 
        err.message.includes('NetworkError') ||
        err.message.includes('TypeError: Failed to fetch')
      )) {
        setError('Running in offline mode - customization saved locally only');
      } else {
        setError('Failed to save customization settings');
      }
    } finally {
      setIsLoading(false);
    }
  }, [customization, user]);

  // Update a specific customization property
  const updateCustomization = useCallback((path: string, value: any, preview: boolean = true) => {
    if (!customization) return;


    // Deep clone the entire customization object
    const updated = deepClone(customization) as UserCustomization;
    
    // Navigate to the correct nested property
    const keys = path.split('.');
    let current: any = updated;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    // Set the final value
    current[keys[keys.length - 1]] = value;

    
    setCustomization(updated);
    setHasUnsavedChanges(true);
    
    if (preview) {
      applyCustomization(updated);
    }
  }, [customization, originalCustomization]);

  // Update theme colors (primary and accent together)
  const updateThemeColors = useCallback((primaryColor: string, accentColor: string, preview: boolean = true) => {
    if (!customization) return;


    const updated = deepClone(customization) as UserCustomization;
    updated.theme.primaryColor = primaryColor;
    updated.theme.accentColor = accentColor;

    
    setCustomization(updated);
    setHasUnsavedChanges(true);
    
    if (preview) {
      applyCustomization(updated);
    }
  }, [customization, originalCustomization]);

  // Reset to default customization
  const resetToDefaults = useCallback(() => {
    if (!user) return;

    const defaultCustomization = createDefaultCustomization(user.id);
    setCustomization(defaultCustomization);
    applyCustomization(defaultCustomization);
    setHasUnsavedChanges(true);
  }, [user]);

  // Refresh customization from database
  const refreshCustomization = useCallback(async () => {
    await loadCustomization();
  }, [loadCustomization]);

  // Load customization when user changes
  useEffect(() => {
    loadCustomization();
  }, [loadCustomization]);

  // Check for unsaved changes
  useEffect(() => {
    if (customization && originalCustomization) {
      
      // Use deep comparison to check for changes
      const hasChanges = !isEqual(customization, originalCustomization);
      setHasUnsavedChanges(hasChanges);
    }
  }, [customization, originalCustomization]);

  return {
    customization,
    isLoading,
    error,
    updateCustomization,
    updateThemeColors,
    saveCustomization,
    resetToDefaults,
    refreshCustomization,
    hasUnsavedChanges
  };
};
