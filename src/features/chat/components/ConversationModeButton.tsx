import { Car, Heading as Headset, ToggleLeft, ToggleRight } from 'lucide-react';
import React from 'react';
import Tooltip from '@/components/Tooltip';
import type { SoundType } from '../hooks/useSoundEffects';

interface ConversationModeButtonProps {
  isConversationMode: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
  onSoundPlay?: (soundType: SoundType) => void;
  enhanced?: boolean;
}

const ConversationModeButton: React.FC<ConversationModeButtonProps> = ({
  isConversationMode,
  onToggle,
  disabled = false,
  className = '',
  onSoundPlay,
  enhanced = false
}) => {
  const handleToggle = () => {
    if (disabled) return;
    
    if (onSoundPlay) {
      onSoundPlay('toggle');
    }
    
    onToggle();
  };

  if (enhanced) {
    return (
      <Tooltip content={isConversationMode ? "Turn off conversation mode" : "Turn on conversation mode"}>
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`neumorphic-button flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full transition-all duration-300 ${
            isConversationMode 
              ? 'bg-gradient-to-r from-green-400 to-green-500 text-white border border-green-500 shadow-md shadow-green-500/20 hover:shadow-lg hover:shadow-green-500/30' 
              : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 hover:from-gray-200 hover:to-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          aria-label={isConversationMode ? "Disable conversation mode" : "Enable conversation mode"}
          aria-pressed={isConversationMode}
        >
          <div className="flex items-center gap-1">
            {isConversationMode ? (
              <Car className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : (
              <Headset className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )}
            <span className="text-xs font-medium">Conversation Mode</span>
          </div>
          
          <div className="relative">
            {isConversationMode ? (
              <ToggleRight className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            ) : (
              <ToggleLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            )}
          </div>
          
          {/* Animated glow effect for active state */}
          {isConversationMode && (
            <div className="absolute inset-0 rounded-full bg-green-400 -z-10 blur-md opacity-20 animate-pulse"></div>
          )}
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={isConversationMode ? "Turn off conversation mode" : "Turn on conversation mode"}>
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`neumorphic-button flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full transition-all duration-300 ${
          isConversationMode 
            ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200' 
            : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        aria-label={isConversationMode ? "Disable conversation mode" : "Enable conversation mode"}
        aria-pressed={isConversationMode}
      >
        <div className="flex items-center gap-1">
          {isConversationMode ? (
            <Car className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          ) : (
            <Headset className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          )}
          <span className="text-xs font-medium">Conversation Mode</span>
        </div>
        
        <div className="relative">
          {isConversationMode ? (
            <ToggleRight className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
          ) : (
            <ToggleLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
          )}
        </div>
      </button>
    </Tooltip>
  );
};

export default ConversationModeButton;