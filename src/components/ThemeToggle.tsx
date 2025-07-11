import type { SoundType } from '../hooks/useSoundEffects';
import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import Tooltip from './Tooltip';

interface ThemeToggleProps {
  themeMode: 'light' | 'dark' | 'auto';
  onThemeChange: (mode: 'light' | 'dark' | 'auto') => void;
  onSoundPlay?: (soundType: SoundType) => void;
  className?: string;
  variant?: 'icon' | 'button' | 'menu-item';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({
  themeMode,
  onThemeChange,
  onSoundPlay,
  className = '',
  variant = 'icon'
}) => {
  const handleThemeChange = (mode: 'light' | 'dark' | 'auto') => {
    if (onSoundPlay) {
      onSoundPlay('click'); 
    }
    onThemeChange(mode);
  };

  const getTooltipContent = () => {
    switch (themeMode) {
      case 'light': return 'Switch to dark mode';
      case 'dark': return 'Switch to light mode';
      case 'auto': return 'Using system preference';
    }
  };

  if (variant === 'menu-item') {
    return ( 
      <div className="p-3 space-y-2">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Theme</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleThemeChange('light')}
            className={`flex-1 p-2 rounded-lg flex flex-col items-center gap-1 ${
              themeMode === 'light' 
                ? 'bg-blue-900 text-blue-300 border border-blue-700' 
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700' 
            }`}
          >
            <Sun className="w-5 h-5" />
            <span className="text-xs">Light</span>
          </button>
          
          <button
            onClick={() => handleThemeChange('dark')}
            className={`flex-1 p-2 rounded-lg flex flex-col items-center gap-1 ${
              themeMode === 'dark' 
                ? 'bg-blue-900 text-blue-300 border border-blue-700' 
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700' 
            }`}
          >
            <Moon className="w-5 h-5" />
            <span className="text-xs">Dark</span>
          </button>
          
          <button
            onClick={() => handleThemeChange('auto')}
            className={`flex-1 p-2 rounded-lg flex flex-col items-center gap-1 ${
              themeMode === 'auto' 
                ? 'bg-blue-900 text-blue-300 border border-blue-700' 
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700' 
            }`}
          >
            <Monitor className="w-5 h-5" />
            <span className="text-xs">Auto</span>
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'button') {
    return ( 
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={() => handleThemeChange('light')}
          className={`p-2 rounded-lg transition-colors ${
            themeMode === 'light' 
              ? 'bg-blue-100 text-blue-700' 
              : 'text-gray-500 hover:bg-gray-100'
          }`} 
          aria-label="Light mode"
        >
          <Sun className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => handleThemeChange('dark')}
          className={`p-2 rounded-lg transition-colors ${
            themeMode === 'dark' 
              ? 'bg-blue-100 text-blue-700' 
              : 'text-gray-500 hover:bg-gray-100'
          }`} 
          aria-label="Dark mode"
        >
          <Moon className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => handleThemeChange('auto')}
          className={`p-2 rounded-lg transition-colors ${
            themeMode === 'auto' 
              ? 'bg-blue-100 text-blue-700' 
              : 'text-gray-500 hover:bg-gray-100'
          }`} 
          aria-label="Auto mode (system preference)"
        >
          <Monitor className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Default icon variant
  return ( 
    <Tooltip content={getTooltipContent()}>
      <button 
        onClick={() => {
          // Toggle between light and dark
          const newMode = themeMode === 'light' ? 'dark' : 'light';
          handleThemeChange(newMode);
        }}
        className={`p-2 rounded-full ${themeMode === 'light' 
          ? 'bg-gray-200/90 border border-gray-300 shadow-sm hover:bg-gray-300/90' 
          : 'bg-gray-800/90 border border-gray-700 shadow-sm hover:bg-gray-700/90'
        } transition-colors theme-toggle ${className}`}
        aria-label={getTooltipContent()}
      >
        {themeMode === 'light' 
          ? <Sun className="w-5 h-5 text-amber-500" /> 
          : <Moon className="w-5 h-5 text-indigo-300" />
        } 
      </button>
    </Tooltip>
  );
};

export default ThemeToggle;