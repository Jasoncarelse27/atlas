import React, { useState } from 'react';
import { Volume2, VolumeX, Volume1, Play, Check, Settings, Headphones } from 'lucide-react';
import { SoundTheme, SoundType } from '../hooks/useSoundEffects';
import Tooltip from './Tooltip';

interface SoundSettingsProps {
  isEnabled: boolean;
  onToggleEnabled: () => void;
  soundTheme: SoundTheme;
  onChangeSoundTheme: (theme: SoundTheme) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onPlayTestSound: (type: SoundType) => void;
  className?: string;
}

const SoundSettings: React.FC<SoundSettingsProps> = ({
  isEnabled,
  onToggleEnabled,
  soundTheme,
  onChangeSoundTheme,
  volume,
  onVolumeChange,
  onPlayTestSound,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');

  const getVolumeIcon = () => {
    if (!isEnabled || volume === 0) return VolumeX;
    if (volume < 0.5) return Volume1;
    return Volume2;
  };

  const VolumeIcon = getVolumeIcon();

  const handleVolumeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    onVolumeChange(newVolume);
  };

  const soundThemes: { id: SoundTheme; name: string; description: string }[] = [
    { 
      id: 'apple', 
      name: 'Apple', 
      description: 'Clean, subtle sounds inspired by Apple interfaces' 
    },
    { 
      id: 'minimal', 
      name: 'Minimal', 
      description: 'Very subtle, professional sound effects' 
    },
    { 
      id: 'classic', 
      name: 'Classic', 
      description: 'Traditional UI sound effects' 
    },
    { 
      id: 'none', 
      name: 'None', 
      description: 'No sound effects' 
    }
  ];

  const testSounds: { id: SoundType; name: string }[] = [
    { id: 'click', name: 'Click' },
    { id: 'success', name: 'Success' },
    { id: 'error', name: 'Error' },
    { id: 'notification', name: 'Notification' },
    { id: 'toggle', name: 'Toggle' },
    { id: 'modal_open', name: 'Open Dialog' }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Sound Settings</h3>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'general' 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'advanced' 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Advanced
          </button>
        </div>
      </div>

      {activeTab === 'general' ? (
        <div className="space-y-6">
          {/* Sound Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Sound Effects</h4>
              <p className="text-sm text-gray-600">Enable or disable all sound effects</p>
            </div>
            <button
              onClick={onToggleEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={isEnabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Volume Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Volume</h4>
              <div className="flex items-center gap-2">
                <VolumeIcon className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600 font-mono w-8">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeSliderChange}
              disabled={!isEnabled}
              className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${
                isEnabled ? 'opacity-100' : 'opacity-50'
              }`}
            />
          </div>

          {/* Sound Theme Selection */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Sound Theme</h4>
            <div className="space-y-2">
              {soundThemes.map((theme) => (
                <div
                  key={theme.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    soundTheme === theme.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${!isEnabled && theme.id !== 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => isEnabled || theme.id === 'none' ? onChangeSoundTheme(theme.id) : null}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-gray-900">{theme.name}</h5>
                      <p className="text-sm text-gray-600">{theme.description}</p>
                    </div>
                    {soundTheme === theme.id && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Test Sounds */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Test Sounds</h4>
            <p className="text-sm text-gray-600">
              Click to preview each sound effect
            </p>
            <div className="grid grid-cols-2 gap-2">
              {testSounds.map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => onPlayTestSound(sound.id)}
                  disabled={!isEnabled || soundTheme === 'none'}
                  className={`px-3 py-2 border rounded-lg text-left flex items-center gap-2 transition-colors ${
                    isEnabled && soundTheme !== 'none'
                      ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      : 'border-gray-200 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4 text-gray-600" />
                  <span>{sound.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound Descriptions */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Headphones className="w-4 h-4" />
              About Sound Themes
            </h4>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium">Apple:</span> Clean, subtle sounds inspired by Apple interfaces. Professional and unobtrusive.
              </p>
              <p>
                <span className="font-medium">Minimal:</span> Very subtle sound effects for a distraction-free experience.
              </p>
              <p>
                <span className="font-medium">Classic:</span> Traditional UI sound effects with more pronounced tones.
              </p>
            </div>
          </div>

          {/* Accessibility Note */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Accessibility</h4>
            <p className="text-sm text-blue-700">
              Sound effects provide audio feedback for interactions, but can be disabled completely if preferred. For users with hearing impairments, visual feedback is always provided alongside audio cues.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoundSettings;