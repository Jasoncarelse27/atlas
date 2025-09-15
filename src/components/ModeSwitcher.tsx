import { Headphones, Image as ImageIcon, Lock, MessageSquare } from 'lucide-react';
import { forwardRef } from 'react';
import type { SoundType } from '../hooks/useSoundEffects';
import { useTierAccess } from '../hooks/useTierAccess';
import { Tier } from '../utils/featureAccess';
import Tooltip from './Tooltip';

interface ModeSwitcherProps {
  currentMode: 'text' | 'voice' | 'image';
  onModeChange: (mode: 'text' | 'voice' | 'image') => void;
  userTier: Tier;
  onUpgrade?: () => void;
  className?: string;
  variant?: 'horizontal' | 'vertical' | 'compact';
  disabled?: boolean;
  onSoundPlay?: (soundType: SoundType) => void;
}

const ModeSwitcher = forwardRef<HTMLDivElement, ModeSwitcherProps>(({
  currentMode,
  onModeChange,
  userTier,
  onUpgrade,
  className = '',
  variant = 'horizontal',
  disabled = false,
  onSoundPlay
}, ref) => {
  const { canUse } = useTierAccess(userTier);

  const modes = [
    { 
      id: 'text', 
      label: 'Text', 
      icon: MessageSquare, 
      description: 'Type messages to chat with Atlas',
      feature: 'text' as const
    },
    { 
      id: 'voice', 
      label: 'Voice', 
      icon: Headphones, 
      description: 'Speak to Atlas using voice commands',
      feature: 'audio' as const
    },
    { 
      id: 'image', 
      label: 'Image', 
      icon: ImageIcon, 
      description: 'Upload and analyze images with Atlas',
      feature: 'image' as const
    }
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

  const getButtonClasses = (mode: 'text' | 'voice' | 'image', isFeatureEnabled: boolean) => {
    const baseClasses = 'neumorphic-button flex items-center justify-center transition-all duration-300 backdrop-blur-md border shadow-lg';
    
    const activeClasses = 'bg-blue-100 text-blue-700 border-blue-300 shadow-blue-200/50';
    const inactiveClasses = 'bg-white/80 text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200';
    const disabledClasses = 'opacity-50 cursor-not-allowed';
    const lockedClasses = 'opacity-60 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200';
    
    const isActive = currentMode === mode;
    const isDisabled = disabled || !isFeatureEnabled;
    
    let stateClasses = '';
    if (isActive) {
      stateClasses = activeClasses;
    } else if (!isFeatureEnabled) {
      stateClasses = lockedClasses;
    } else if (isDisabled) {
      stateClasses = disabledClasses;
    } else {
      stateClasses = inactiveClasses;
    }
    
    switch (variant) {
      case 'vertical':
        return `${baseClasses} px-4 py-3 rounded-lg w-full ${stateClasses}`;
      case 'compact':
        return `${baseClasses} p-2 sm:p-3 rounded-lg ${stateClasses}`;
      case 'horizontal':
      default:
        return `${baseClasses} px-3 py-2 sm:px-6 sm:py-3 rounded-lg ${stateClasses}`;
    }
  };

  const handleModeChange = (mode: 'text' | 'voice' | 'image', feature: 'text' | 'audio' | 'image') => {
    if (disabled || currentMode === mode) return;
    
    // Check if feature is enabled for this tier
    if (!canUse(feature)) {
      // Show upgrade modal
      if (onUpgrade) {
        onUpgrade();
      } else {
        alert(`⚠️ ${feature === 'audio' ? 'Voice' : feature === 'image' ? 'Image analysis' : 'Text'} features are available in Atlas Core or Studio. Upgrade to continue!`);
      }
      return;
    }
    
    // Play click sound
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    onModeChange(mode);
  };

  const getUpgradeMessage = (feature: 'text' | 'audio' | 'image') => {
    switch (feature) {
      case 'audio':
        return 'Voice features available in Atlas Core';
      case 'image':
        return 'Image analysis available in Atlas Core';
      default:
        return 'Upgrade to unlock this feature';
    }
  };

  return (
    <div ref={ref} className={getContainerClasses()}>
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isFeatureEnabled = canUse(mode.feature);
        const showLock = !isFeatureEnabled && mode.feature !== 'text';
        
        return (
          <Tooltip 
            key={mode.id} 
            content={
              !isFeatureEnabled && mode.feature !== 'text' 
                ? getUpgradeMessage(mode.feature)
                : mode.description
            } 
            position="top"
          >
            <button
              onClick={() => handleModeChange(mode.id, mode.feature)}
              className={getButtonClasses(mode.id, isFeatureEnabled)}
              disabled={disabled}
              aria-label={`Switch to ${mode.label} mode`}
              aria-pressed={currentMode === mode.id}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${currentMode === mode.id ? '' : ''}`} />
                {showLock && (
                  <Lock className="absolute -top-1 -right-1 w-3 h-3 text-gray-400" />
                )}
              </div>
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