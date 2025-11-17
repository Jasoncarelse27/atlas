import type { User } from '@supabase/supabase-js';
import {
    Crown,
    Grid3X3,
    HelpCircle,
    History,
    LogOut,
    Menu,
    MessageSquare, PlusSquare,
    Settings,
    Sliders as SlidersIcon,
    Sparkles,
    TrendingUp,
    User as UserIcon,
    Volume2 as VolumeIcon, VolumeX,
    Wifi, WifiOff,
    X as XIcon
} from 'lucide-react';
import React, { useState } from 'react';
import { isPaidTier } from '../config/featureAccess';
import type { SoundType } from '../hooks/useSoundEffects';
import type { UserProfile } from '../types/subscription';
import AccountModal from './AccountModal';
import Logo from './Logo';
import NotificationCenter from './NotificationCenter';
import StatusIndicator from './StatusIndicator';
import SubscriptionBadge from './SubscriptionBadge';
import Tooltip from './Tooltip';
import UsageIndicator from './UsageIndicator';

interface HeaderProps {
  currentMode: 'text' | 'voice' | 'image';
  onModeChange: (mode: 'text' | 'voice' | 'image') => void;
  voices: SpeechSynthesisVoice[];
  currentVoice: SpeechSynthesisVoice | null;
  onVoiceChange: (voice: SpeechSynthesisVoice) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  connectionStatus?: 'online' | 'offline' | 'connecting';
  user?: User | null;
  profile?: UserProfile | null;
  onLogout?: () => void;
  onShowUpgrade?: () => void;
  onShowWidgets?: () => void;
  onShowControlCenter?: () => void;
  headerStyle?: 'minimal' | 'standard' | 'expanded';
  onSoundPlay?: (soundType: SoundType) => void;
  onShowSpeedTest?: () => void;
  onShowConversationHistory?: () => void;
  onNewConversation?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  currentMode, 
  onModeChange, 
  voices,
  currentVoice,
  onVoiceChange,
  isMuted,
  onMuteToggle,
  connectionStatus = 'online',
  user,
  profile,
  onLogout,
  onShowUpgrade,
  onShowWidgets,
  onShowControlCenter,
  headerStyle = 'standard',
  onSoundPlay,
  onShowSpeedTest,
  onShowConversationHistory,
  onNewConversation
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const toggleDropdown = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    setIsOpen(!isOpen);
  };
  
  const toggleVoiceDropdown = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    setIsVoiceOpen(!isVoiceOpen);
  };
  
  const toggleUserMenu = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    setIsUserMenuOpen(!isUserMenuOpen);
  };
  
  const toggleMobileMenu = () => {
    if (onSoundPlay) {
      onSoundPlay(isMobileMenuOpen ? 'modal_close' : 'modal_open');
    }
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleModeSelect = (mode: 'text' | 'voice' | 'image') => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    onModeChange(mode);
    setIsOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleVoiceSelect = (voice: SpeechSynthesisVoice) => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    onVoiceChange(voice);
    setIsVoiceOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    setShowAccountModal(false);
    onLogout?.();
  };

  const handleShowUpgrade = () => {
    if (onSoundPlay) {
      onSoundPlay('modal_open');
    }
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    onShowUpgrade?.();
  };

  const handleShowAccount = () => {
    if (onSoundPlay) {
      onSoundPlay('modal_open');
    }
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    setShowAccountModal(true);
  };

  const handleShowWidgets = () => {
    if (onSoundPlay) {
      onSoundPlay('modal_open');
    }
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    onShowWidgets?.();
  };

  const handleShowControlCenter = () => {
    if (onSoundPlay) {
      onSoundPlay('modal_open');
    }
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    onShowControlCenter?.();
  };

  const handleShowHelp = () => {
    if (onSoundPlay) {
      onSoundPlay('modal_open');
    }
    setShowHelp(true);
    setIsMobileMenuOpen(false);
  };

  const handleCloseHelp = () => {
    if (onSoundPlay) {
      onSoundPlay('modal_close');
    }
    setShowHelp(false);
  };

  const handleMuteToggle = () => {
    if (onSoundPlay) {
      onSoundPlay('toggle');
    }
    onMuteToggle();
  };

  const handleShowSpeedTest = () => {
    if (onSoundPlay) {
      onSoundPlay('modal_open');
    }
    setIsMobileMenuOpen(false);
    onShowSpeedTest?.();
  };

  const handleShowConversationHistory = () => {
    if (onSoundPlay) {
      onSoundPlay('modal_open');
    }
    setIsMobileMenuOpen(false);
    onShowConversationHistory?.();
  };

  const handleNewConversation = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    setIsMobileMenuOpen(false);
    onNewConversation?.();
  };

  // Test sound button for debugging
  const handleTestSound = () => {
    if (onSoundPlay) {
      onSoundPlay('success');
      setTimeout(() => onSoundPlay('notification'), 500);
      setTimeout(() => onSoundPlay('error'), 1000);
    }
  };

  const getModeDisplayName = (mode: 'text' | 'voice' | 'image') => {
    switch (mode) {
      case 'text': return 'Text';
      case 'voice': return 'Voice';
      case 'image': return 'Image';
      default: return 'Voice';
    }
  };

  const getModeDescription = (mode: 'text' | 'voice' | 'image') => {
    switch (mode) {
      case 'text': return 'Type messages to chat with Atlas';
      case 'voice': return 'Speak to Atlas using voice commands';
      case 'image': return 'Upload and analyze images with Atlas';
      default: return 'Voice interaction mode';
    }
  };

  const getUserDisplayName = () => {
    if (!user) return 'User';
    
    // Try to get name from user metadata
    const fullName = user.user_metadata?.full_name;
    const firstName = user.user_metadata?.first_name;
    const lastName = user.user_metadata?.last_name;
    
    if (fullName) return fullName;
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    
    // Fallback to email
    if (user.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    
    return 'User';
  };

  const getUserInitials = () => {
    const displayName = getUserDisplayName();
    const words = displayName.split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  };

  const getDaysRemaining = () => {
    if (!profile || profile.tier !== 'basic' || profile.subscription_status !== 'trial' || !profile.trial_ends_at) {
      return null;
    }

    const trialEnd = new Date(profile.trial_ends_at);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  const daysRemaining = getDaysRemaining();

  // Get header style classes
  const getHeaderClasses = () => {
    const baseClasses = "flex justify-between items-center z-20 transition-all duration-300";
    
    switch (headerStyle) {
      case 'minimal':
        return `${baseClasses} p-2 sm:p-3`;
      case 'expanded':
        return `${baseClasses} p-4 sm:p-6`;
      case 'standard':
      default:
        return `${baseClasses} p-3 sm:p-4`;
    }
  };

  const getLogoSize = () => {
    switch (headerStyle) {
      case 'minimal':
        return 'text-lg';
      case 'expanded':
        return 'text-2xl';
      case 'standard':
      default:
        return 'text-xl';
    }
  };

  const getButtonSize = () => {
    switch (headerStyle) {
      case 'minimal':
        return 'px-2 py-1.5 text-sm';
      case 'expanded':
        return 'px-4 py-3 text-base';
      case 'standard':
      default:
        return 'px-3 py-2 text-sm';
    }
  };

  const getIconSize = () => {
    switch (headerStyle) {
      case 'minimal':
        return 'w-4 h-4';
      case 'expanded':
        return 'w-6 h-6';
      case 'standard':
      default:
        return 'w-4 h-4';
    }
  };

  return (
    <>
      <div className={getHeaderClasses()} role="banner">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Logo className={getLogoSize()} />
          {/* Status Indicator - Always visible with responsive sizing */}
          <Tooltip content={`Status: ${connectionStatus}. Click for speed test.`} position="bottom">
            <button
              onClick={onShowSpeedTest}
              className="inline-flex cursor-pointer"
              aria-label={`Connection status: ${connectionStatus}. Click to run speed test.`}
            >
              <StatusIndicator 
                status={connectionStatus} 
                size="sm"
                className="inline-flex"
              />
            </button>
          </Tooltip>
        </div>
        
        {/* Mobile Status and Mode Indicator */}
        <div className="lg:hidden flex items-center gap-2">
          {/* Subscription Badge - Mobile */}
          {profile && headerStyle !== 'minimal' && (
            <SubscriptionBadge 
              profile={profile} 
              daysRemaining={daysRemaining}
              className="text-xs"
            />
          )}
          
          {/* Current Mode Badge - Mobile */}
          <div className={`neumorphic-button bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm ${getButtonSize()}`}>
            <span className="text-text dark:text-white font-medium text-xs">
              {getModeDisplayName(currentMode)}
            </span>
          </div>
          
          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className={`neumorphic-button rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center shadow-sm ${getButtonSize()}`}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <XIcon className={`text-text dark:text-white ${getIconSize()}`} />
            ) : (
              <Menu className={`text-text dark:text-white ${getIconSize()}`} />
            )}
          </button>
        </div>

        {/* Desktop Controls */}
        <nav className="hidden lg:flex items-center gap-2" role="navigation" aria-label="Main navigation">
          {/* Test Sound Button - Development Only */}
          {import.meta.env.DEV && (
            <Tooltip content="Test sound effects" position="bottom">
              <button
                onClick={handleTestSound}
                className={`neumorphic-button rounded-md bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 cursor-pointer transition-colors flex items-center shadow-sm ${getButtonSize()}`}
                aria-label="Test sound effects"
              >
                <VolumeIcon className={`text-yellow-600 ${getIconSize()}`} />
              </button>
            </Tooltip>
          )}

          {/* New Conversation Button */}
          <Tooltip content="New conversation" position="bottom">
            <button
              onClick={handleNewConversation}
              className={`neumorphic-button-strong rounded-md bg-atlas-sage hover:bg-atlas-success text-white cursor-pointer transition-colors flex items-center shadow-sm ${getButtonSize()}`}
              aria-label="Start new conversation"
            >
              <PlusSquare className={`text-white ${getIconSize()}`} />
            </button>
          </Tooltip>

          {/* Conversation History Button */}
          <Tooltip content="Conversation history" position="bottom">
            <button
              onClick={handleShowConversationHistory}
              className={`neumorphic-button rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center shadow-sm ${getButtonSize()}`}
              aria-label="View conversation history"
            >
              <History className={`text-gray-600 dark:text-gray-300 ${getIconSize()}`} />
            </button>
          </Tooltip>

          {/* Subscription Badge */}
          {profile && headerStyle !== 'minimal' && (
            <SubscriptionBadge 
              profile={profile} 
              daysRemaining={daysRemaining}
              showDetails={headerStyle === 'expanded'}
            />
          )}

          {/* Upgrade Button - Always show for testing */}
          {profile && (
            <Tooltip content="View upgrade options and pricing" position="bottom">
              <button
                onClick={handleShowUpgrade}
                className={`neumorphic-button-strong rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white cursor-pointer transition-all flex items-center gap-2 transform hover:scale-105 ${getButtonSize()}`}
                aria-label="View upgrade options"
              >
                <Crown className={getIconSize()} />
                <span className="font-medium">
                  {isPaidTier(profile.tier) ? 'Plans' : 'Upgrade'}
                </span>
              </button>
            </Tooltip>
          )}

          {/* Control Center Button */}
          {user && profile && (
            <Tooltip content="Open control center" position="bottom">
              <button
                onClick={handleShowControlCenter}
                className={`neumorphic-button rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center shadow-sm ${getButtonSize()}`}
                aria-label="Open control center"
              >
                <SlidersIcon className={`text-gray-600 dark:text-gray-300 ${getIconSize()}`} />
              </button>
            </Tooltip>
          )}

          {/* Widgets Button */}
          {user && profile && headerStyle !== 'minimal' && (
            <Tooltip content="Open widget dashboard" position="bottom">
              <button
                onClick={handleShowWidgets}
                className={`neumorphic-button rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center shadow-sm ${getButtonSize()}`}
                aria-label="Open widget dashboard"
              >
                <Grid3X3 className={`text-gray-600 dark:text-gray-300 ${getIconSize()}`} />
              </button>
            </Tooltip>
          )}

          {/* Help Button */}
          {headerStyle !== 'minimal' && (
            <Tooltip content="View keyboard shortcuts and tips" position="bottom">
              <button
                onClick={handleShowHelp}
                className={`neumorphic-button rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center shadow-sm ${getButtonSize()}`}
                aria-label="View help and keyboard shortcuts"
              >
                <HelpCircle className={`text-gray-600 dark:text-gray-300 ${getIconSize()}`} />
              </button>
            </Tooltip>
          )}

          {/* Mute Button */}
          <Tooltip 
            content={isMuted ? "Unmute audio responses" : "Mute audio responses"} 
            position="bottom"
          >
            <button
              onClick={handleMuteToggle}
              className={`neumorphic-button rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center shadow-sm ${getButtonSize()}`}
              aria-label={isMuted ? "Unmute audio responses" : "Mute audio responses"}
              aria-pressed={isMuted}
            >
              {isMuted ? (
                <VolumeX className={`text-red-500 dark:text-red-400 ${getIconSize()}`} />
              ) : (
                <VolumeIcon className={`text-text dark:text-white ${getIconSize()}`} />
              )}
            </button>
          </Tooltip>

          {/* Voice Selection Dropdown */}
          {currentMode === 'voice' && !isMuted && headerStyle !== 'minimal' && (
            <div className="relative">
              <Tooltip content="Select voice for audio responses" position="bottom">
                <button
                  onClick={toggleVoiceDropdown}
                  className={`neumorphic-button rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-sm ${getButtonSize()}`}
                  aria-label="Select voice for audio responses"
                  aria-expanded={isVoiceOpen}
                  aria-haspopup="listbox"
                >
                  <Settings className={`text-text dark:text-white ${getIconSize()}`} />
                  {headerStyle === 'expanded' && (
                    <span className="text-text dark:text-white font-medium max-w-[120px] truncate">
                      {currentVoice?.name || 'Default Voice'}
                    </span>
                  )}
                  <span className={`text-xs opacity-70 transition-transform duration-200 ${isVoiceOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
              </Tooltip>
              
              {isVoiceOpen && voices.length > 0 && (
                <div className="absolute right-0 mt-2 w-72 z-30 neumorphic-card bg-white/95 dark:bg-gray-900/95 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden max-h-96 overflow-y-auto" role="listbox">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-text dark:text-white">Select Voice</h3>
                    <p className="text-xs text-text/70 dark:text-gray-400 mt-1">Choose your preferred voice for audio responses</p>
                  </div>
                  {voices.map((voice) => (
                    <button 
                      key={voice.name}
                      className={`w-full px-4 py-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between group
                        ${voice.name === currentVoice?.name ? 'text-text dark:text-white bg-gray-100 dark:bg-gray-800' : 'text-text dark:text-white'}`}
                      onClick={() => handleVoiceSelect(voice)}
                      role="option"
                      aria-selected={voice.name === currentVoice?.name}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{voice.name}</div>
                        <div className="text-xs opacity-70 truncate">{voice.lang}</div>
                      </div>
                      {voice.name === currentVoice?.name && (
                        <div className="w-2 h-2 bg-atlas-sage rounded-full flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mode Selection Dropdown */}
          <div className="relative">
            <Tooltip content={getModeDescription(currentMode)} position="bottom">
              <button
                onClick={toggleDropdown}
                className={`neumorphic-button rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-sm ${getButtonSize()}`}
                aria-label={`Current mode: ${getModeDisplayName(currentMode)}. Click to change mode.`}
                aria-expanded={isOpen}
                aria-haspopup="menu"
              >
                <span className="text-text dark:text-white font-semibold">
                  {getModeDisplayName(currentMode)}
                </span>
                <span className={`text-xs opacity-70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
            </Tooltip>
            
            {isOpen && (
              <div className="absolute right-0 mt-2 w-48 z-30 neumorphic-card bg-white/95 dark:bg-gray-900/95 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden" role="menu">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-text dark:text-white">Interaction Mode</h3>
                </div>
                {(['text', 'voice', 'image'] as const).map((mode) => (
                  <button 
                    key={mode}
                    className={`w-full px-4 py-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group
                      ${currentMode === mode ? 'text-text dark:text-white bg-gray-100 dark:bg-gray-800' : 'text-text dark:text-white'}`}
                    onClick={() => handleModeSelect(mode)}
                    role="menuitem"
                    aria-label={`Switch to ${getModeDisplayName(mode)} mode`}
                  >
                    <div className="font-medium">{getModeDisplayName(mode)}</div>
                    <div className="text-xs opacity-70 mt-1">{getModeDescription(mode)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          {user && (
            <NotificationCenter className="mr-2" />
          )}

          {/* User Menu */}
          {user && (
            <div className="relative">
              <Tooltip content={`Signed in as ${getUserDisplayName()}`} position="bottom">
                <button
                  onClick={toggleUserMenu}
                  className={`neumorphic-button rounded-md bg-white/80 border border-gray-300 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm ${getButtonSize()}`}
                  aria-label={`User menu for ${getUserDisplayName()}`}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                >
                  <div className="w-6 h-6 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {getUserInitials()}
                  </div>
                  {headerStyle === 'expanded' && (
                    <span className="text-text dark:text-white font-medium max-w-[100px] truncate">
                      {getUserDisplayName()}
                    </span>
                  )}
                  <span className={`text-xs opacity-70 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
              </Tooltip>
              
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 z-30 neumorphic-card bg-white/95 dark:bg-gray-900/95 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden" role="menu">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {getUserInitials()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-text dark:text-white truncate">{getUserDisplayName()}</h3>
                        <p className="text-xs text-text/70 dark:text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    
                    {/* Subscription Info */}
                    {profile && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <SubscriptionBadge 
                            profile={profile} 
                            daysRemaining={daysRemaining}
                            showDetails={true}
                          />
                          <button
                            onClick={handleShowUpgrade}
                            className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                          >
                            View Plans
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Usage Stats */}
                  {profile && (
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-text dark:text-white mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Usage This Month
                      </h4>
                      <div className="space-y-3">
                        <UsageIndicator profile={profile} type="requests" />
                        <UsageIndicator profile={profile} type="audio" />
                        <UsageIndicator profile={profile} type="storage" />
                      </div>
                    </div>
                  )}
                  
                  <div className="p-2">
                    <button
                      onClick={handleShowUpgrade}
                      className="w-full px-3 py-2 text-left cursor-pointer hover:bg-purple-50 transition-colors flex items-center gap-3 rounded-md text-purple-600 hover:text-purple-700 mb-2 neumorphic-button"
                      role="menuitem"
                    >
                      <Crown className="w-4 h-4" />
                      <span className="text-sm font-medium">View All Plans</span>
                    </button>

                    <button
                      onClick={handleShowControlCenter}
                      className="w-full px-3 py-2 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-3 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 mb-2 neumorphic-button"
                      role="menuitem"
                    >
                      <SlidersIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">Control Center</span>
                    </button>

                    <button
                      onClick={handleShowWidgets}
                      className="w-full px-3 py-2 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-3 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 mb-2 neumorphic-button"
                      role="menuitem"
                    >
                      <Grid3X3 className="w-4 h-4" />
                      <span className="text-sm font-medium">Widget Dashboard</span>
                    </button>

                    <button
                      onClick={handleShowAccount}
                      className="w-full px-3 py-2 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-3 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 mb-2 neumorphic-button"
                      role="menuitem"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">Manage Account</span>
                    </button>
                    
                    <button
                      onClick={handleShowSpeedTest}
                      className="w-full px-3 py-2 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-3 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 mb-2 neumorphic-button"
                      role="menuitem"
                    >
                      {connectionStatus === 'online' ? (
                        <Wifi className="w-4 h-4" />
                      ) : (
                        <WifiOff className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">Speed Test</span>
                    </button>
                    
                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-2 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-3 rounded-md text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 neumorphic-button"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-medium">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => {
            if (onSoundPlay) {
              onSoundPlay('modal_close');
            }
            setIsMobileMenuOpen(false);
          }}>
            <div className="absolute top-0 right-0 w-80 max-w-[90vw] h-full neumorphic-card bg-white/95 dark:bg-gray-900/95 border-l border-gray-300 dark:border-gray-700 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Mobile menu">
              {/* Mobile Menu Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-text dark:text-white">Settings</h2>
                  {/* Status Indicator in Mobile Menu Header */}
                  <button
                    onClick={handleShowSpeedTest}
                    className="inline-flex cursor-pointer"
                    aria-label={`Connection status: ${connectionStatus}. Click to run speed test.`}
                  >
                    <StatusIndicator 
                      status={connectionStatus} 
                      size="sm"
                      className="inline-flex"
                    />
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (onSoundPlay) {
                      onSoundPlay('modal_close');
                    }
                    setIsMobileMenuOpen(false);
                  }}
                  className="neumorphic-button p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close mobile menu"
                >
                  <XIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              </div>

              <div className="p-4 space-y-6 overflow-y-auto h-full pb-20">
                {/* User Info */}
                {user && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Account</h3>
                    <div className="flex items-center gap-3 p-3 neumorphic-card bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {getUserInitials()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-text dark:text-white truncate">{getUserDisplayName()}</h4>
                        <p className="text-xs text-text/70 dark:text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    
                    {/* Subscription Info */}
                    {profile && (
                      <div className="space-y-3">
                        <SubscriptionBadge 
                          profile={profile} 
                          daysRemaining={daysRemaining}
                          showDetails={true}
                          className="w-full justify-center"
                        />
                        
                        {/* Usage Stats */}
                        <div className="p-3 neumorphic-card bg-gray-100 dark:bg-gray-800 rounded-lg space-y-3">
                          <h4 className="text-sm font-medium text-text dark:text-white">Usage This Month</h4>
                          <UsageIndicator profile={profile} type="requests" />
                          <UsageIndicator profile={profile} type="audio" />
                          <UsageIndicator profile={profile} type="storage" />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleShowUpgrade}
                      className="w-full px-4 py-3 neumorphic-button-strong bg-gradient-to-r from-purple-500 to-pink-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-3 justify-center"
                    >
                      <Crown className="w-4 h-4" />
                      <span className="font-medium">View Plans</span>
                    </button>

                    <button
                      onClick={handleShowControlCenter}
                      className="w-full px-4 py-3 neumorphic-button bg-atlas-sage/10 hover:bg-atlas-sage/20 border border-atlas-sage/30 text-atlas-stone rounded-lg transition-colors flex items-center gap-3"
                    >
                      <SlidersIcon className="w-4 h-4" />
                      <span className="font-medium">Control Center</span>
                    </button>

                    <button
                      onClick={handleShowWidgets}
                      className="w-full px-4 py-3 neumorphic-button bg-green-100 hover:bg-green-200 border border-green-200 text-green-700 rounded-lg transition-colors flex items-center gap-3"
                    >
                      <Grid3X3 className="w-4 h-4" />
                      <span className="font-medium">Widget Dashboard</span>
                    </button>

                    <button
                      onClick={handleShowAccount}
                      className="w-full px-4 py-3 neumorphic-button bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-3"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span className="font-medium">Manage Account</span>
                    </button>
                    
                    <button
                      onClick={handleShowSpeedTest}
                      className="w-full px-4 py-3 neumorphic-button bg-atlas-sage/10 hover:bg-atlas-sage/20 border border-atlas-sage/30 text-atlas-stone rounded-lg transition-colors flex items-center gap-3"
                    >
                      {connectionStatus === 'online' ? (
                        <Wifi className="w-4 h-4" />
                      ) : (
                        <WifiOff className="w-4 h-4" />
                      )}
                      <span className="font-medium">Speed Test</span>
                    </button>
                    
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 neumorphic-button bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg transition-colors flex items-center gap-3"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="font-medium">Sign Out</span>
                    </button>
                  </div>
                )}

                {/* Conversation Management */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Conversations</h3>
                  <div className="space-y-2">
                    <button
                      onClick={handleNewConversation}
                      className="w-full px-4 py-3 neumorphic-button-strong bg-atlas-sage hover:bg-atlas-success text-white rounded-lg transition-colors flex items-center gap-3"
                    >
                      <PlusSquare className="w-4 h-4" />
                      <span className="font-medium">New Conversation</span>
                    </button>
                    
                    <button
                      onClick={handleShowConversationHistory}
                      className="w-full px-4 py-3 neumorphic-button bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-3"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="font-medium">View All Conversations</span>
                    </button>
                    
                    <a
                      href="/rituals"
                      className="w-full px-4 py-3 neumorphic-button bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-3"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="font-medium">Ritual Library</span>
                    </a>
                  </div>
                </div>

                {/* Mode Selection */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Interaction Mode</h3>
                  <div className="space-y-2">
                    {(['voice', 'text', 'image'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => handleModeSelect(mode)}
                        className={`w-full p-4 rounded-lg border transition-colors text-left neumorphic-button ${
                          currentMode === mode
                            ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-text dark:text-white'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-text dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        aria-label={`Switch to ${getModeDisplayName(mode)} mode`}
                      >
                        <div className="font-medium text-base">{getModeDisplayName(mode)}</div>
                        <div className="text-sm opacity-70 mt-1">{getModeDescription(mode)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio Controls */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Audio Settings</h3>
                  
                  {/* Mute Toggle */}
                  <button
                    onClick={handleMuteToggle}
                    className={`w-full p-4 rounded-lg border transition-colors flex items-center gap-3 neumorphic-button ${
                      isMuted 
                        ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400' 
                        : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-text dark:text-white'
                    }`}
                    aria-label={isMuted ? "Enable audio responses" : "Disable audio responses"}
                    aria-pressed={isMuted}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <VolumeIcon className="w-5 h-5" />}
                    <div className="text-left">
                      <div className="font-medium">{isMuted ? 'Audio Muted' : 'Audio Enabled'}</div>
                      <div className="text-sm opacity-70">{isMuted ? 'Tap to enable audio responses' : 'Tap to mute audio responses'}</div>
                    </div>
                  </button>

                  {/* Voice Selection */}
                  {currentMode === 'voice' && !isMuted && voices.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-text dark:text-white">Voice Selection</h4>
                      <div className="max-h-48 overflow-y-auto space-y-2 scrollbar-thin">
                        {voices.map((voice) => (
                          <button
                            key={voice.name}
                            onClick={() => handleVoiceSelect(voice)}
                            className={`w-full p-3 rounded-lg border transition-colors text-left neumorphic-button ${
                              voice.name === currentVoice?.name
                                ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-text dark:text-white'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-text dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                            aria-label={`Select ${voice.name} voice`}
                          >
                            <div className="font-medium truncate">{voice.name}</div>
                            <div className="text-xs opacity-70 truncate">{voice.lang}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Help */}
                <div className="space-y-4">
                  <button
                    onClick={handleShowHelp}
                    className="w-full p-4 neumorphic-button bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-3"
                    aria-label="View help and keyboard shortcuts"
                  >
                    <HelpCircle className="w-5 h-5" />
                    <div className="text-left">
                      <div className="font-medium">Help & Tips</div>
                      <div className="text-sm opacity-70">View keyboard shortcuts and usage tips</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Modal */}
        {showHelp && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <div className="neumorphic-card bg-white/95 dark:bg-gray-900/95 rounded-xl border border-gray-300 dark:border-gray-700 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 id="help-title" className="text-xl font-bold text-text dark:text-white">Atlas Help</h2>
                <button
                  onClick={handleCloseHelp}
                  className="neumorphic-button text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors p-1"
                  aria-label="Close help dialog"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4 text-sm text-text dark:text-white">
                <div>
                  <h3 className="font-semibold text-text dark:text-white mb-2">Voice Mode</h3>
                  <ul className="space-y-1 text-text/70 dark:text-gray-400">
                    <li>• Hold the microphone button to speak</li>
                    <li>• Release to send your message</li>
                    <li>• Toggle mute to disable audio responses</li>
                    <li>• Enable conversation mode for hands-free interaction</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-text mb-2">Text Mode</h3>
                  <ul className="space-y-1 text-text/70">
                    <li>• Type your message and press Enter</li>
                    <li>• Use suggested commands for quick actions</li>
                    <li>• Upload files for analysis</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-text mb-2">Image Mode</h3>
                  <ul className="space-y-1 text-text/70">
                    <li>• Drag and drop images to analyze</li>
                    <li>• Supports JPEG, PNG, GIF, WebP</li>
                    <li>• Maximum file size: 10MB</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-text mb-2">Conversation Mode</h3>
                  <ul className="space-y-1 text-text/70">
                    <li>• Hands-free continuous listening</li>
                    <li>• Automatically detects when you stop speaking</li>
                    <li>• Perfect for driving or when your hands are busy</li>
                    <li>• Toggle on/off in voice mode</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-text mb-2">Conversation History</h3>
                  <ul className="space-y-1 text-text/70">
                    <li>• View and manage past conversations</li>
                    <li>• Rename conversations for better organization</li>
                    <li>• Pin important conversations</li>
                    <li>• Delete conversations you no longer need</li>
                    <li>• Export and import your conversation history</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-text mb-2">Control Center</h3>
                  <ul className="space-y-1 text-text/70">
                    <li>• Customize themes, colors, and fonts</li>
                    <li>• Configure layout and accessibility options</li>
                    <li>• Set language and regional preferences</li>
                    <li>• Export and import your settings</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-text mb-2">Widget Dashboard</h3>
                  <ul className="space-y-1 text-text/70">
                    <li>• Customize your Atlas experience with widgets</li>
                    <li>• Track usage, set goals, and access quick actions</li>
                    <li>• Drag and drop widgets to organize your workspace</li>
                    <li>• Access via the grid icon in the header</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-text mb-2">Account Management</h3>
                  <ul className="space-y-1 text-text/70">
                    <li>• Click your avatar to access account settings</li>
                    <li>• Manage profile, security, and privacy</li>
                    <li>• Submit feedback and bug reports</li>
                    <li>• Export your data or delete account</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-text mb-2">Subscription Tiers</h3>
                  <ul className="space-y-1 text-text/70">
                    <li>• Basic: 7-day free trial with essential features</li>
                    <li>• Standard: More requests, image analysis, priority support</li>
                    <li>• Pro: Unlimited usage, advanced AI, analytics</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-text mb-2">Connection Status</h3>
                  <ul className="space-y-1 text-text/70">
                    <li>• Green dot: Connected and ready</li>
                    <li>• Yellow dot: Connecting to services</li>
                    <li>• Red dot: Connection issues</li>
                    <li>• Click the status indicator to run a speed test</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Account Modal */}
      {showAccountModal && user && profile && (
        <AccountModal
          isOpen={showAccountModal}
          onClose={() => {
            if (onSoundPlay) {
              onSoundPlay('modal_close');
            }
            setShowAccountModal(false);
          }}
          user={user}
          profile={profile}
          onLogout={handleLogout}
          onSoundPlay={onSoundPlay}
        />
      )}
    </>
  );
};

export default Header;
