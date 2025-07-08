import React, { forwardRef } from 'react';
import { MessageSquare, Headphones, Image as ImageIcon } from 'lucide-react';
import Tooltip from './Tooltip';
import { SoundType } from '../hooks/useSoundEffects';

interface ModeSwitcherProps {
  currentMode: 'text' | 'voice' | 'image';
  onModeChange: (mode: 'text' | 'voice' | 'image') => void;
  className?: string;
  variant?: 'horizontal' | 'vertical' | 'compact';
  disabled?: boolean;
  onSoundPlay?: (soundType: SoundType) => void;
}

const ModeSwitcher = forwardRef<HTMLDivElement, ModeSwitcherProps>(({
  currentMode,
  onModeChange,
  className = '',
  variant = 'horizontal',
  disabled = false,
  onSoundPlay
}, ref) => {
  const modes = [
    { id: 'voice', label: 'Voice', icon: Headphones, description: 'Speak to Atlas using voice commands' },
    { id: 'text', label: 'Text', icon: MessageSquare, description: 'Type messages to chat with Atlas' },
    { id: 'image', label: 'Image', icon: ImageIcon, description: 'Upload and analyze images with Atlas' }
  ] as const;

  const getContainerClasses = () => {
    const baseClasses = 'flex justify-center gap-2 sm:gap-4 z-20';
    
    switch (variant) {
      case 'vertical':
        return `${baseClasses} flex-col ${className}`;
      case 'compact':
        return `${baseClasses} ${className}`;
      case 'horizontal':
      default:
        return `${baseClasses} ${className}`;
    }
  };

  const getButtonClasses = (mode: 'text' | 'voice' | 'image') => {
    const baseClasses = 'neumorphic-button flex items-center justify-center transition-all duration-300 backdrop-blur-md border shadow-lg';
    
    const activeClasses = 'bg-blue-100 text-blue-700 border-blue-300 shadow-blue-200/50';
    const inactiveClasses = 'bg-white/80 text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200';
    const disabledClasses = 'opacity-50 cursor-not-allowed';
    
    switch (variant) {
      case 'vertical':
        return `${baseClasses} px-4 py-3 rounded-lg w-full ${
          currentMode === mode 
            ? activeClasses 
            : disabled 
              ? disabledClasses 
              : inactiveClasses
        }`;
      case 'compact':
        return `${baseClasses} p-2 sm:p-3 rounded-lg ${
          currentMode === mode 
            ? activeClasses 
            : disabled 
              ? disabledClasses 
              : inactiveClasses
        }`;
      case 'horizontal':
      default:
        return `${baseClasses} px-3 py-2 sm:px-6 sm:py-3 rounded-lg ${
          currentMode === mode 
            ? activeClasses 
            : disabled 
              ? disabledClasses 
              : inactiveClasses
        }`;
    }
  };

  const handleModeChange = (mode: 'text' | 'voice' | 'image') => {
    if (disabled || currentMode === mode) return;
    
    // Play click sound
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    onModeChange(mode);
  };

  return (
    <div ref={ref} className={getContainerClasses()}>
      {modes.map((mode) => {
        const Icon = mode.icon;
        
        return (
          <Tooltip key={mode.id} content={mode.description} position="top">
            <button
              onClick={() => handleModeChange(mode.id)}
              className={getButtonClasses(mode.id)}
              disabled={disabled}
              aria-label={`Switch to ${mode.label} mode`}
              aria-pressed={currentMode === mode.id}
            >
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${currentMode === mode.id ? '' : ''}`} />
              {variant !== 'compact' && (
                <span className="ml-2 font-medium text-xs sm:text-sm">{mode.label}</span>
              )}
              {currentMode === mode.id && variant === 'compact' && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full" />
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
});

ModeSwitcher.displayName = 'ModeSwitcher';

export default ModeSwitcher;