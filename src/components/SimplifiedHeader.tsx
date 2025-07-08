import React from 'react';
import { Menu, MessageSquare, Headphones, Image as ImageIcon, PlusSquare } from 'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { SoundType } from '../hooks/useSoundEffects';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '../types/subscription';
import StatusIndicator from './StatusIndicator';

interface SimplifiedHeaderProps {
  currentMode: 'text' | 'voice' | 'image';
  onModeChange: (mode: 'text' | 'voice' | 'image') => void;
  onMenuOpen: () => void;
  onNewConversation: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
  themeMode?: 'light' | 'dark' | 'auto';
  onThemeChange?: (mode: 'light' | 'dark' | 'auto') => void;
  user?: User | null;
  profile?: UserProfile | null;
  connectionStatus?: 'online' | 'offline' | 'connecting';
}

const SimplifiedHeader: React.FC<SimplifiedHeaderProps> = ({
  currentMode,
  onModeChange,
  onMenuOpen,
  onNewConversation,
  onSoundPlay,
  themeMode = 'dark',
  onThemeChange,
  user,
  profile,
  connectionStatus = 'online'
}) => {
  const handleMenuClick = () => {
    if (onSoundPlay) onSoundPlay('click');
    onMenuOpen();
  };

  const handleModeChange = (mode: 'text' | 'voice' | 'image') => {
    if (mode === currentMode) return;
    if (onSoundPlay) onSoundPlay('click');
    onModeChange(mode);
  };

  const handleNewConversation = () => {
    if (onSoundPlay) onSoundPlay('click');
    onNewConversation();
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Top Header with Menu and New Conversation buttons - Dark theme */}
      <header className="w-full flex items-center justify-between p-4 bg-transparent header">
        {/* Left: Menu Button */}
        <button 
          onClick={handleMenuClick}
          className={`p-2 rounded-full ${themeMode === 'light' 
            ? 'bg-white/90 border border-gray-300 shadow-sm hover:bg-gray-100 text-gray-700' 
            : 'bg-gray-800/90 border border-gray-700 shadow-sm hover:bg-gray-700 text-gray-300'
          } transition-colors`}
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Logo in center */}
        <Logo className="text-xl logo" />

        {/* Right: New Conversation Button */}
        <div className="flex items-center gap-2">
          {onThemeChange && (
            <ThemeToggle
              themeMode={themeMode}
              onThemeChange={onThemeChange} 
              className="theme-toggle"
              onSoundPlay={onSoundPlay}
            />
          )}
          
          <button
            onClick={handleNewConversation}
            className={`p-2 rounded-full ${themeMode === 'light' 
              ? 'bg-white/90 border border-gray-300 shadow-sm hover:bg-gray-100' 
              : 'bg-gray-800/90 border border-gray-700 shadow-sm hover:bg-gray-700'
            } transition-colors`}
            aria-label="New conversation"
          >
            <PlusSquare className="w-6 h-6 text-blue-400" />
          </button>
        </div>
      </header>

      {/* Mode Switcher below header - Dark theme */}
      <div className={`flex items-center backdrop-blur-sm rounded-full p-1 shadow-sm mt-2 mb-4 mode-switcher max-w-xs mx-auto ${
        themeMode === 'light'
          ? 'bg-white/90 border border-gray-300'
          : 'bg-gray-800/90 border border-gray-700'
      } z-50`}>
        <button
          onClick={() => handleModeChange('text')}
          className={`flex items-center justify-center px-4 py-2 rounded-full transition-colors ${
            currentMode === 'text' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : themeMode === 'light' 
                ? 'text-gray-600 hover:text-gray-800' 
                : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="Text mode"
          aria-pressed={currentMode === 'text'}
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          onClick={() => handleModeChange('voice')}
          className={`flex items-center justify-center px-4 py-2 rounded-full transition-colors ${
            currentMode === 'voice' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : themeMode === 'light' 
                ? 'text-gray-600 hover:text-gray-800' 
                : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="Voice mode"
          aria-pressed={currentMode === 'voice'}
        >
          <Headphones className="w-5 h-5" />
        </button>
        <button
          onClick={() => handleModeChange('image')}
          className={`flex items-center justify-center px-4 py-2 rounded-full transition-colors ${
            currentMode === 'image' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : themeMode === 'light' 
                ? 'text-gray-600 hover:text-gray-800' 
                : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="Image mode"
          aria-pressed={currentMode === 'image'}
        >
          <ImageIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default SimplifiedHeader;
