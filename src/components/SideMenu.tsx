import React from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../types/subscription';
import { 
  X, User as UserIcon, Settings, Grid3X3, History, Wifi, WifiOff, LogOut, 
  HelpCircle, Volume2, VolumeX, Crown, MessageSquare, Headphones, Image as ImageIcon,
  TrendingUp, Clock, HardDrive, Moon, Sun, Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SoundType } from '../hooks/useSoundEffects';
import SubscriptionBadge from './SubscriptionBadge';
import StatusIndicator from './StatusIndicator';
import ThemeToggle from './ThemeToggle';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  profile: UserProfile | null;
  currentMode: 'text' | 'voice' | 'image';
  onModeChange: (mode: 'text' | 'voice' | 'image') => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  connectionStatus: 'online' | 'offline' | 'connecting';
  onLogout: () => void;
  onShowUpgrade: () => void;
  onShowWidgets: () => void;
  onShowControlCenter: () => void;
  onShowHelp: () => void;
  onShowSpeedTest: () => void;
  onShowConversationHistory: () => void;
  themeMode: 'light' | 'dark' | 'auto';
  onThemeChange: (mode: 'light' | 'dark' | 'auto') => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  onClose,
  user,
  profile,
  currentMode,
  onModeChange,
  isMuted,
  onMuteToggle,
  connectionStatus,
  onLogout,
  onShowUpgrade,
  onShowWidgets,
  onShowControlCenter,
  onShowHelp,
  onShowSpeedTest,
  onShowConversationHistory,
  themeMode,
  onThemeChange,
  onSoundPlay
}) => {
  const handleClose = () => {
    if (onSoundPlay) onSoundPlay('modal_close');
    onClose();
  };

  const handleModeChange = (mode: 'text' | 'voice' | 'image') => {
    if (onSoundPlay) onSoundPlay('click');
    onModeChange(mode);
    onClose();
  };

  const handleMuteToggle = () => {
    if (onSoundPlay) onSoundPlay('toggle');
    onMuteToggle();
  };

  const handleAction = (action: () => void) => {
    if (onSoundPlay) onSoundPlay('click');
    action();
    onClose();
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

  // Get days remaining in trial
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={handleClose}
            style={{ backdropFilter: 'none' }}
          />
          
          {/* Side Menu Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-xl z-50 flex flex-col"
            style={{ filter: 'none', backdropFilter: 'none' }}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Menu</h2>
              <button
                onClick={handleClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* User Profile Section */}
              {user && (
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
                      {getUserInitials()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{getUserDisplayName()}</h3>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  
                  {/* Subscription Info */}
                  {profile && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <SubscriptionBadge 
                          profile={profile} 
                          daysRemaining={daysRemaining}
                          showDetails={true}
                        />
                        <button
                          onClick={() => handleAction(onShowUpgrade)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Upgrade
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Mode Selection */}
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Mode</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => handleModeChange('text')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      currentMode === 'text' 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>Text Mode</span>
                  </button>
                  
                  <button
                    onClick={() => handleModeChange('voice')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      currentMode === 'voice' 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Headphones className="w-5 h-5" />
                    <span>Voice Mode</span>
                  </button>
                  
                  <button
                    onClick={() => handleModeChange('image')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      currentMode === 'image' 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span>Image Mode</span>
                  </button>
                </div>
              </div>
              
              {/* Usage Stats */}
              {profile && (
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Usage</h3>
                  
                  <div className="space-y-3">
                    {/* Requests */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2 text-gray-600">
                          <MessageSquare className="w-4 h-4" />
                          <span>Requests</span>
                        </div>
                        <span className="text-gray-700 font-medium">
                          {profile.usage_stats.requests_this_month}/
                          {TIER_CONFIGS[profile.tier].limits.requests_per_month === -1 
                            ? '∞' 
                            : TIER_CONFIGS[profile.tier].limits.requests_per_month}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full" 
                          style={{ 
                            width: `${TIER_CONFIGS[profile.tier].limits.requests_per_month === -1 
                              ? 10 
                              : Math.min(100, (profile.usage_stats.requests_this_month / TIER_CONFIGS[profile.tier].limits.requests_per_month) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Audio */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>Audio</span>
                        </div>
                        <span className="text-gray-700 font-medium">
                          {profile.usage_stats.audio_minutes_this_month}/
                          {TIER_CONFIGS[profile.tier].limits.audio_minutes_per_month === -1 
                            ? '∞' 
                            : TIER_CONFIGS[profile.tier].limits.audio_minutes_per_month}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full" 
                          style={{ 
                            width: `${TIER_CONFIGS[profile.tier].limits.audio_minutes_per_month === -1 
                              ? 10 
                              : Math.min(100, (profile.usage_stats.audio_minutes_this_month / TIER_CONFIGS[profile.tier].limits.audio_minutes_per_month) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Storage */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2 text-gray-600">
                          <HardDrive className="w-4 h-4" />
                          <span>Storage</span>
                        </div>
                        <span className="text-gray-700 font-medium">
                          {profile.usage_stats.storage_used_mb}/
                          {TIER_CONFIGS[profile.tier].limits.storage_limit_mb} MB
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full" 
                          style={{ 
                            width: `${Math.min(100, (profile.usage_stats.storage_used_mb / TIER_CONFIGS[profile.tier].limits.storage_limit_mb) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Quick Actions */}
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => handleAction(onShowConversationHistory)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <History className="w-5 h-5" />
                    <span>Conversation History</span>
                  </button>
                  
                  <button
                    onClick={() => handleAction(onShowWidgets)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Grid3X3 className="w-5 h-5" />
                    <span>Widget Dashboard</span>
                  </button>
                  
                  <button
                    onClick={() => handleAction(onShowControlCenter)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-5 h-5" />
                    <span>Control Center</span>
                  </button>
                  
                  <button
                    onClick={() => handleAction(onShowHelp)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <HelpCircle className="w-5 h-5" />
                    <span>Help & Tips</span>
                  </button>
                </div>
              </div>
              
              {/* Theme Settings */}
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Theme</h3>
                <ThemeToggle 
                  themeMode={themeMode}
                  onThemeChange={onThemeChange}
                  onSoundPlay={onSoundPlay}
                  variant="menu-item"
                />
              </div>
              
              {/* Settings */}
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Settings</h3>
                <div className="space-y-3">
                  {/* Audio Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-gray-600" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-gray-600" />
                      )}
                      <span className="text-gray-700">Audio Responses</span>
                    </div>
                    <button
                      onClick={handleMuteToggle}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isMuted ? 'bg-gray-300' : 'bg-blue-600'
                      }`}
                      role="switch"
                      aria-checked={!isMuted}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isMuted ? 'translate-x-0' : 'translate-x-7'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {/* Connection Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {connectionStatus === 'online' ? (
                        <Wifi className="w-5 h-5 text-gray-600" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-gray-600" />
                      )}
                      <span className="text-gray-700">Connection</span>
                    </div>
                    <button
                      onClick={() => handleAction(onShowSpeedTest)}
                      className="flex items-center gap-2"
                    >
                      <StatusIndicator 
                        status={connectionStatus} 
                        size="sm"
                      />
                      <span className="text-sm text-gray-600">Check</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-200 mt-auto">
              <button
                onClick={() => handleAction(onLogout)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
              
              {/* Version Info */}
              <div className="mt-3 text-center text-xs text-gray-500">
                Atlas 2.0 • Version 2025.06.1
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Import TIER_CONFIGS for usage limits
import { TIER_CONFIGS } from '../types/subscription';

export default SideMenu;
