
import type { User } from '@supabase/supabase-js';
import {
    AlertTriangle,
    Download,
    Layout,
    Moon,
    Palette,
    RefreshCw,
    Save,
    Settings,
    Sliders,
    Sun,
    Upload,
    Volume2,
    X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useCustomization } from '../hooks/useCustomization';
import type { SoundTheme, SoundType } from '../hooks/useSoundEffects';
import { useSoundEffects } from '../hooks/useSoundEffects';
import type { UserProfile } from '../types/subscription';
import LoadingSpinner from './LoadingSpinner';
import SoundSettings from './SoundSettings';

interface ControlCenterProps {
  user: User;
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

const ControlCenter: React.FC<ControlCenterProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'theme' | 'layout' | 'sound' | 'preferences'>('theme');
  const [selectedColor, setSelectedColor] = useState<string>('#D3DCAB'); // Atlas sage
  const [selectedAccentColor, setSelectedAccentColor] = useState<string>('#F3D3B8'); // Atlas peach
  const [selectedMode, setSelectedMode] = useState<'light' | 'dark' | 'auto'>('light');
  const [selectedFontSize, setSelectedFontSize] = useState<number>(14);
  const [selectedBorderRadius, setSelectedBorderRadius] = useState<number>(8);
  const [selectedHeaderStyle, setSelectedHeaderStyle] = useState<'minimal' | 'standard' | 'expanded'>('standard');
  const [selectedWidgetLayout, setSelectedWidgetLayout] = useState<'grid' | 'list' | 'masonry'>('grid');
  const [compactMode, setCompactMode] = useState<boolean>(false);
  const [showAnimations, setShowAnimations] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  
  // Accessibility settings
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [largeText, setLargeText] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  
  // Sound settings
  const { 
    playSound, 
    isEnabled: soundEnabled, 
    soundTheme,
    volume: soundVolume,
    setVolume: setSoundVolume
  } = useSoundEffects();
  
  const { 
    customization, 
    updateCustomization, 
    updateThemeColors, 
    saveCustomization, 
    resetToDefaults,
    hasUnsavedChanges
  } = useCustomization();

  // Initialize state from customization
  useEffect(() => {
    if (customization) {
      setSelectedColor(customization.theme.primaryColor);
      setSelectedAccentColor(customization.theme.accentColor);
      setSelectedMode(customization.theme.mode);
      setSelectedFontSize(customization.theme.fontSize);
      setSelectedBorderRadius(customization.theme.borderRadius);
      setSelectedHeaderStyle(customization.layout.headerStyle);
      setSelectedWidgetLayout(customization.layout.widgetLayout);
      setCompactMode(customization.layout.compactMode);
      setShowAnimations(customization.layout.showAnimations);
      setHighContrast(customization.preferences.accessibility.highContrast);
      setLargeText(customization.preferences.accessibility.largeText);
      setReduceMotion(customization.preferences.accessibility.reduceMotion);
    }
  }, [customization]);

  // Update hasChanges state
  useEffect(() => {
    setHasChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  const handleSave = async () => {
    setIsLoading(true);
    playSound('click');
    
    try {
      await saveCustomization();
      playSound('success');
    } catch (error) {
      playSound('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
    playSound('notification');
  };

  const confirmReset = () => {
    resetToDefaults();
    setShowResetConfirm(false);
    playSound('success');
  };

  const handleTabChange = (tab: 'theme' | 'layout' | 'sound' | 'preferences') => {
    setActiveTab(tab);
    playSound('click');
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    updateThemeColors(color, selectedAccentColor);
    playSound('click');
  };

  const handleAccentColorChange = (color: string) => {
    setSelectedAccentColor(color);
    updateThemeColors(selectedColor, color);
    playSound('click');
  };

  const handleModeChange = (mode: 'light' | 'dark' | 'auto') => {
    setSelectedMode(mode);
    updateCustomization('theme.mode', mode);
    playSound('click');
  };

  const handleFontSizeChange = (size: number) => {
    setSelectedFontSize(size);
    updateCustomization('theme.fontSize', size);
    playSound('click');
  };

  const handleBorderRadiusChange = (radius: number) => {
    setSelectedBorderRadius(radius);
    updateCustomization('theme.borderRadius', radius);
    playSound('click');
  };

  const handleHeaderStyleChange = (style: 'minimal' | 'standard' | 'expanded') => {
    setSelectedHeaderStyle(style);
    updateCustomization('layout.headerStyle', style);
    playSound('click');
  };

  const handleWidgetLayoutChange = (layout: 'grid' | 'list' | 'masonry') => {
    setSelectedWidgetLayout(layout);
    updateCustomization('layout.widgetLayout', layout);
    playSound('click');
  };

  const handleCompactModeToggle = () => {
    setCompactMode(!compactMode);
    updateCustomization('layout.compactMode', !compactMode);
    playSound('toggle');
  };

  const handleShowAnimationsToggle = () => {
    setShowAnimations(!showAnimations);
    updateCustomization('layout.showAnimations', !showAnimations);
    playSound('toggle');
  };

  const handleHighContrastToggle = () => {
    setHighContrast(!highContrast);
    updateCustomization('preferences.accessibility.highContrast', !highContrast);
    playSound('toggle');
  };

  const handleLargeTextToggle = () => {
    setLargeText(!largeText);
    updateCustomization('preferences.accessibility.largeText', !largeText);
    playSound('toggle');
  };

  const handleReduceMotionToggle = () => {
    setReduceMotion(!reduceMotion);
    updateCustomization('preferences.accessibility.reduceMotion', !reduceMotion);
    playSound('toggle');
  };

  const handleToggleSoundEffects = () => {
    updateCustomization('preferences.soundEffects', !soundEnabled);
    playSound('toggle');
  };

  const handleChangeSoundTheme = (theme: SoundTheme) => {
    updateCustomization('preferences.soundTheme', theme);
    playSound('click');
  };

  const handleSoundVolumeChange = (volume: number) => {
    setSoundVolume(volume);
    updateCustomization('preferences.soundVolume', volume);
  };

  const handlePlayTestSound = (type: SoundType) => {
    playSound(type);
  };

  if (!isOpen) return null;

  const colorOptions = [
    { name: 'Sage', value: '#D3DCAB' },      // Atlas primary
    { name: 'Sand', value: '#CEC1B8' },      // Atlas secondary
    { name: 'Peach', value: '#F3D3B8' },     // Atlas accent
    { name: 'Stone', value: '#978671' },     // Atlas tertiary
    { name: 'Pearl', value: '#F4E8E1' },     // Atlas background
    { name: 'Success', value: '#A7C080' },   // Muted sage green
    { name: 'Warning', value: '#E8C88E' },   // Warm gold
    { name: 'Lavender', value: '#B8A8C4' },  // Soft purple option
    { name: 'Slate', value: '#7A8A99' },     // Cool gray option
    { name: 'Terracotta', value: '#C89F7F' } // Warm earth option
  ];

  const accentColorOptions = [
    { name: 'Peach', value: '#F3D3B8' },     // Atlas accent
    { name: 'Sage', value: '#D3DCAB' },      // Atlas primary
    { name: 'Stone', value: '#978671' },     // Atlas tertiary
    { name: 'Success', value: '#A7C080' },   // Muted sage green
    { name: 'Warning', value: '#E8C88E' },   // Warm gold
    { name: 'Sand', value: '#CEC1B8' },      // Atlas secondary
    { name: 'Lavender', value: '#B8A8C4' },  // Soft purple option
    { name: 'Rose', value: '#D89090' },      // Muted rose
    { name: 'Terracotta', value: '#C89F7F' },// Warm earth option
    { name: 'Slate', value: '#7A8A99' }      // Cool gray option
  ];

  const fontSizeOptions = [
    { name: 'Small', value: 12 },
    { name: 'Medium', value: 14 },
    { name: 'Large', value: 16 },
    { name: 'Extra Large', value: 18 }
  ];

  const borderRadiusOptions = [
    { name: 'None', value: 0 },
    { name: 'Small', value: 4 },
    { name: 'Medium', value: 8 },
    { name: 'Large', value: 12 },
    { name: 'Extra Large', value: 16 }
  ];

  const renderThemeTab = () => (
    <div className="space-y-6">
      {/* Color Theme */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Color Theme</h3>
        
        <div className="space-y-4">
          {/* Primary Color */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Primary Color</h4>
            <div className="grid grid-cols-5 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleColorChange(color.value)}
                  className={`w-10 h-10 rounded-full transition-all ${
                    selectedColor === color.value 
                      ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' 
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color.value }}
                  aria-label={`${color.name} primary color`}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          
          {/* Accent Color */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Accent Color</h4>
            <div className="grid grid-cols-5 gap-2">
              {accentColorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleAccentColorChange(color.value)}
                  className={`w-10 h-10 rounded-full transition-all ${
                    selectedAccentColor === color.value 
                      ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' 
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color.value }}
                  aria-label={`${color.name} accent color`}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          
          {/* Color Preview */}
          <div className="p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-700">Preview</h4>
            </div>
            <div className="flex flex-col gap-3">
              <div 
                className="h-10 rounded-lg flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: selectedColor }}
              >
                Primary Color
              </div>
              <div 
                className="h-10 rounded-lg flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: selectedAccentColor }}
              >
                Accent Color
              </div>
              <div className="flex gap-2">
                <button 
                  className="px-4 py-2 rounded-lg text-white font-medium flex-1"
                  style={{ backgroundColor: selectedColor }}
                >
                  Primary Button
                </button>
                <button 
                  className="px-4 py-2 rounded-lg text-white font-medium flex-1"
                  style={{ backgroundColor: selectedAccentColor }}
                >
                  Accent Button
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mode Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Mode</h3>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleModeChange('light')}
            className={`p-4 rounded-lg border transition-colors ${
              selectedMode === 'light' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <Sun className="w-6 h-6 text-amber-500" />
              <span className="font-medium">Light</span>
            </div>
          </button>
          
          <button
            onClick={() => handleModeChange('dark')}
            className={`p-4 rounded-lg border transition-colors ${
              selectedMode === 'dark' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <Moon className="w-6 h-6 text-indigo-600" />
              <span className="font-medium">Dark</span>
            </div>
          </button>
          
          <button
            onClick={() => handleModeChange('auto')}
            className={`p-4 rounded-lg border transition-colors ${
              selectedMode === 'auto' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Sun className="w-6 h-6 text-amber-500 absolute -left-1 -top-1 transform scale-75" />
                <Moon className="w-6 h-6 text-indigo-600 absolute -right-1 -bottom-1 transform scale-75" />
              </div>
              <span className="font-medium">Auto</span>
            </div>
          </button>
        </div>
      </div>
      
      {/* Typography & Borders */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Typography & Borders</h3>
        
        <div className="space-y-4">
          {/* Font Size */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Font Size</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {fontSizeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleFontSizeChange(option.value)}
                  className={`p-3 rounded-lg border transition-colors ${
                    selectedFontSize === option.value 
                      ? 'border-blue-300 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <span className="font-medium" style={{ fontSize: `${option.value}px` }}>
                      {option.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Border Radius */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Border Radius</h4>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {borderRadiusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleBorderRadiusChange(option.value)}
                  className={`p-3 rounded-lg border transition-colors ${
                    selectedBorderRadius === option.value 
                      ? 'border-blue-300 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      className="w-8 h-8 border-2 border-gray-400"
                      style={{ borderRadius: `${option.value}px` }}
                    />
                    <span className="text-xs font-medium">{option.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLayoutTab = () => (
    <div className="space-y-6">
      {/* Header Style */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Header Style</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleHeaderStyleChange('minimal')}
            className={`p-4 rounded-lg border transition-colors ${
              selectedHeaderStyle === 'minimal' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-6 bg-gray-200 rounded-lg flex items-center px-2">
                <div className="w-8 h-3 bg-gray-400 rounded-full" />
              </div>
              <span className="font-medium">Minimal</span>
            </div>
          </button>
          
          <button
            onClick={() => handleHeaderStyleChange('standard')}
            className={`p-4 rounded-lg border transition-colors ${
              selectedHeaderStyle === 'standard' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-8 bg-gray-200 rounded-lg flex items-center px-2">
                <div className="w-8 h-3 bg-gray-400 rounded-full" />
                <div className="ml-auto flex gap-1">
                  <div className="w-4 h-4 bg-gray-400 rounded-full" />
                  <div className="w-4 h-4 bg-gray-400 rounded-full" />
                </div>
              </div>
              <span className="font-medium">Standard</span>
            </div>
          </button>
          
          <button
            onClick={() => handleHeaderStyleChange('expanded')}
            className={`p-4 rounded-lg border transition-colors ${
              selectedHeaderStyle === 'expanded' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-10 bg-gray-200 rounded-lg flex items-center px-2">
                <div className="w-10 h-4 bg-gray-400 rounded-full" />
                <div className="ml-auto flex gap-1">
                  <div className="w-6 h-6 bg-gray-400 rounded-full" />
                  <div className="w-6 h-6 bg-gray-400 rounded-full" />
                  <div className="w-6 h-6 bg-gray-400 rounded-full" />
                </div>
              </div>
              <span className="font-medium">Expanded</span>
            </div>
          </button>
        </div>
      </div>
      
      {/* Widget Layout */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Widget Layout</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleWidgetLayoutChange('grid')}
            className={`p-4 rounded-lg border transition-colors ${
              selectedWidgetLayout === 'grid' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-16 bg-gray-200 rounded-lg p-1">
                <div className="grid grid-cols-2 gap-1 h-full">
                  <div className="bg-gray-400 rounded" />
                  <div className="bg-gray-400 rounded" />
                  <div className="bg-gray-400 rounded" />
                  <div className="bg-gray-400 rounded" />
                </div>
              </div>
              <span className="font-medium">Grid</span>
            </div>
          </button>
          
          <button
            onClick={() => handleWidgetLayoutChange('list')}
            className={`p-4 rounded-lg border transition-colors ${
              selectedWidgetLayout === 'list' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-16 bg-gray-200 rounded-lg p-1 flex flex-col gap-1">
                <div className="bg-gray-400 rounded h-1/3" />
                <div className="bg-gray-400 rounded h-1/3" />
                <div className="bg-gray-400 rounded h-1/3" />
              </div>
              <span className="font-medium">List</span>
            </div>
          </button>
          
          <button
            onClick={() => handleWidgetLayoutChange('masonry')}
            className={`p-4 rounded-lg border transition-colors ${
              selectedWidgetLayout === 'masonry' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-16 bg-gray-200 rounded-lg p-1">
                <div className="grid grid-cols-3 gap-1 h-full">
                  <div className="bg-gray-400 rounded col-span-2 row-span-1" />
                  <div className="bg-gray-400 rounded col-span-1 row-span-2" />
                  <div className="bg-gray-400 rounded col-span-1 row-span-1" />
                  <div className="bg-gray-400 rounded col-span-1 row-span-1" />
                </div>
              </div>
              <span className="font-medium">Masonry</span>
            </div>
          </button>
        </div>
      </div>
      
      {/* Layout Options */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Layout Options</h3>
        
        <div className="space-y-4">
          {/* Compact Mode */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Compact Mode</h4>
              <p className="text-sm text-gray-600">Reduce spacing for a denser layout</p>
            </div>
            <button
              onClick={handleCompactModeToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                compactMode ? 'bg-atlas-sage' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={compactMode}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  compactMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {/* Show Animations */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Show Animations</h4>
              <p className="text-sm text-gray-600">Enable UI animations and transitions</p>
            </div>
            <button
              onClick={handleShowAnimationsToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showAnimations ? 'bg-atlas-sage' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={showAnimations}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showAnimations ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
      
      {/* Accessibility */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Accessibility</h3>
        
        <div className="space-y-4">
          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">High Contrast</h4>
              <p className="text-sm text-gray-600">Increase contrast for better visibility</p>
            </div>
            <button
              onClick={handleHighContrastToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                highContrast ? 'bg-atlas-sage' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={highContrast}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  highContrast ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {/* Large Text */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Large Text</h4>
              <p className="text-sm text-gray-600">Increase text size throughout the app</p>
            </div>
            <button
              onClick={handleLargeTextToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                largeText ? 'bg-atlas-sage' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={largeText}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  largeText ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {/* Reduce Motion */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Reduce Motion</h4>
              <p className="text-sm text-gray-600">Minimize animations and motion effects</p>
            </div>
            <button
              onClick={handleReduceMotionToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                reduceMotion ? 'bg-atlas-sage' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={reduceMotion}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  reduceMotion ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSoundTab = () => (
    <SoundSettings
      isEnabled={soundEnabled}
      onToggleEnabled={handleToggleSoundEffects}
      soundTheme={soundTheme}
      onChangeSoundTheme={handleChangeSoundTheme}
      volume={soundVolume}
      onVolumeChange={handleSoundVolumeChange}
      onPlayTestSound={handlePlayTestSound}
    />
  );

  const renderPreferencesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Language & Region</h3>
        
        <div className="space-y-4">
          {/* Language */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Language</h4>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={customization?.preferences?.language || 'en'}
              onChange={(e) => updateCustomization('preferences.language', e.target.value)}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
            </select>
          </div>
          
          {/* Timezone */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Timezone</h4>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={customization?.preferences?.timezone || 'UTC'}
              onChange={(e) => updateCustomization('preferences.timezone', e.target.value)}
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
            </select>
          </div>
          
          {/* Date Format */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Date Format</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
                { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
                { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' }
              ].map((format) => (
                <button
                  key={format.value}
                  onClick={() => updateCustomization('preferences.dateFormat', format.value)}
                  className={`p-2 border rounded-lg transition-colors ${
                    customization?.preferences?.dateFormat === format.value
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Behavior */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Behavior</h3>
        
        <div className="space-y-4">
          {/* Auto Save */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Auto Save</h4>
              <p className="text-sm text-gray-600">Automatically save changes</p>
            </div>
            <button
              onClick={() => updateCustomization('preferences.autoSave', !customization?.preferences?.autoSave)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                customization?.preferences?.autoSave ? 'bg-atlas-sage' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={customization?.preferences?.autoSave}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  customization?.preferences?.autoSave ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Notifications</h4>
              <p className="text-sm text-gray-600">Show system notifications</p>
            </div>
            <button
              onClick={() => updateCustomization('preferences.notifications', !customization?.preferences?.notifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                customization?.preferences?.notifications ? 'bg-atlas-sage' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={customization?.preferences?.notifications}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  customization?.preferences?.notifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {/* Keyboard Shortcuts */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Keyboard Shortcuts</h4>
              <p className="text-sm text-gray-600">Enable keyboard shortcuts</p>
            </div>
            <button
              onClick={() => updateCustomization('preferences.keyboardShortcuts', !customization?.preferences?.keyboardShortcuts)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                customization?.preferences?.keyboardShortcuts ? 'bg-atlas-sage' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={customization?.preferences?.keyboardShortcuts}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  customization?.preferences?.keyboardShortcuts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
      
      {/* Import/Export */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Import/Export</h3>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              // Export settings as JSON
              const dataStr = JSON.stringify(customization, null, 2);
              const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
              
              const link = document.createElement('a');
              link.setAttribute('href', dataUri);
              link.setAttribute('download', 'atlas-settings.json');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              
              playSound('success');
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Settings</span>
          </button>
          
          <label className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import Settings</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const json = JSON.parse(event.target?.result as string);
                    
                    // Apply imported settings
                    if (json.theme) {
                      setSelectedColor(json.theme.primaryColor || '#D3DCAB');
                      setSelectedAccentColor(json.theme.accentColor || '#F3D3B8');
                      setSelectedMode(json.theme.mode || 'light');
                      setSelectedFontSize(json.theme.fontSize || 14);
                      setSelectedBorderRadius(json.theme.borderRadius || 8);
                      
                      updateThemeColors(
                        json.theme.primaryColor || '#D3DCAB',
                        json.theme.accentColor || '#F3D3B8'
                      );
                      updateCustomization('theme.mode', json.theme.mode || 'light');
                      updateCustomization('theme.fontSize', json.theme.fontSize || 14);
                      updateCustomization('theme.borderRadius', json.theme.borderRadius || 8);
                    }
                    
                    if (json.layout) {
                      setSelectedHeaderStyle(json.layout.headerStyle || 'standard');
                      setSelectedWidgetLayout(json.layout.widgetLayout || 'grid');
                      setCompactMode(json.layout.compactMode || false);
                      setShowAnimations(json.layout.showAnimations !== false);
                      
                      updateCustomization('layout.headerStyle', json.layout.headerStyle || 'standard');
                      updateCustomization('layout.widgetLayout', json.layout.widgetLayout || 'grid');
                      updateCustomization('layout.compactMode', json.layout.compactMode || false);
                      updateCustomization('layout.showAnimations', json.layout.showAnimations !== false);
                    }
                    
                    if (json.preferences?.accessibility) {
                      setHighContrast(json.preferences.accessibility.highContrast || false);
                      setLargeText(json.preferences.accessibility.largeText || false);
                      setReduceMotion(json.preferences.accessibility.reduceMotion || false);
                      
                      updateCustomization('preferences.accessibility.highContrast', json.preferences.accessibility.highContrast || false);
                      updateCustomization('preferences.accessibility.largeText', json.preferences.accessibility.largeText || false);
                      updateCustomization('preferences.accessibility.reduceMotion', json.preferences.accessibility.reduceMotion || false);
                    }
                    
                    playSound('success');
                  } catch (error) {
                    playSound('error');
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl border border-gray-300 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        style={{ filter: 'none', backdropFilter: 'none' }}
      >
        {/* Header for mobile */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Sliders className="w-5 h-5 text-atlas-sage" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Control Center</h2>
                <p className="text-xs text-gray-600">Customize your Atlas experience</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Horizontal scrollable tabs for mobile */}
          <div className="flex overflow-x-auto mt-4 pb-2 gap-2 scrollbar-thin">
            <button
              onClick={() => setActiveTab('theme')}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'theme'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Theme</span>
            </button>
            
            <button
              onClick={() => setActiveTab('layout')}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'layout'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Layout className="w-4 h-4" />
              <span>Layout</span>
            </button>
            
            <button
              onClick={() => setActiveTab('sound')}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'sound'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Sound</span>
            </button>
            
            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'preferences'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Preferences</span>
            </button>
          </div>
        </div>

        {/* Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden md:block w-64 border-r border-gray-200 bg-gray-50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Sliders className="w-6 h-6 text-atlas-sage" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Control Center</h2>
              <p className="text-gray-600 text-sm">Customize your Atlas experience</p>
            </div>
          </div>
          
          <nav className="space-y-1">
            <button
              onClick={() => handleTabChange('theme')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'theme'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Palette className="w-5 h-5" />
              <span className="font-medium">Theme</span>
            </button>
            
            <button
              onClick={() => handleTabChange('layout')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'layout'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Layout className="w-5 h-5" />
              <span className="font-medium">Layout</span>
            </button>
            
            <button
              onClick={() => handleTabChange('sound')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'sound'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Volume2 className="w-5 h-5" />
              <span className="font-medium">Sound</span>
            </button>
            
            <button
              onClick={() => handleTabChange('preferences')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'preferences'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium">Preferences</span>
            </button>
          </nav>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="space-y-4">
              <button
                onClick={handleSave}
                disabled={isLoading || !hasChanges}
                className="w-full px-4 py-2 bg-atlas-sage hover:bg-atlas-success text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
              </button>
              
              <button
                onClick={handleReset}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset to Defaults</span>
              </button>
            </div>
            
            {hasChanges && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">
                    You have unsaved changes. Click "Save Changes" to apply them.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Close button for desktop */}
          <div className="hidden md:flex justify-end p-4 border-b border-gray-200">
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content area */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            {activeTab === 'theme' && renderThemeTab()}
            {activeTab === 'layout' && renderLayoutTab()}
            {activeTab === 'sound' && renderSoundTab()}
            {activeTab === 'preferences' && renderPreferencesTab()}
          </div>
          
          {/* Mobile action buttons */}
          <div className="md:hidden p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isLoading || !hasChanges}
                className="flex-1 px-4 py-2 bg-atlas-sage hover:bg-atlas-success text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isLoading ? 'Saving...' : 'Save'}</span>
              </button>
              
              <button
                onClick={handleReset}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            </div>
            
            {hasChanges && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">
                    You have unsaved changes
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-300 p-6 max-w-md w-full" style={{ filter: 'none', backdropFilter: 'none' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reset to Defaults?</h3>
            <p className="text-gray-600 mb-6">
              This will reset all your customizations to the default settings. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  playSound('click');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlCenter;