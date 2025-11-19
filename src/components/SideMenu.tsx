import type { User } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Clock,
    Crown,
    Grid3X3,
    HardDrive,
    Headphones,
    HelpCircle,
    History,
    Image as ImageIcon,
    LogOut,
    MessageSquare,
    Settings,
    TrendingUp,
    Volume2, VolumeX,
    Wifi, WifiOff,
    X
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { SoundType } from '../hooks/useSoundEffects';
import type { UserProfile } from '../types/subscription';
import { TIER_CONFIGS as TIER_CONFIGS_IMPORT } from '../types/subscription';
import StatusIndicator from './StatusIndicator';
import SubscriptionBadge from './SubscriptionBadge';
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
  const navigate = useNavigate();
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
            className="fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-[#F9F6F3] dark:bg-gray-900 shadow-xl z-50 flex flex-col transition-colors duration-200"
            style={{ filter: 'none', backdropFilter: 'none' }}
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#3B3632] dark:text-white">Menu</h2>
              <button
                onClick={handleClose}
                className="p-2 text-atlas-stone/70 hover:text-atlas-stone hover:bg-atlas-sand/30 rounded-full transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* User Profile Section */}
              {user && (
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-atlas-sage to-atlas-peach rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm">
                      {getUserInitials()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-atlas-stone truncate">{getUserDisplayName()}</h3>
                      <p className="text-sm text-atlas-stone/60 truncate">{user.email}</p>
                    </div>
                  </div>
                  
                  {/* Subscription Info - Current Tier */}
                  {profile && (
                     <div className="mt-4 p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl">
                       <h3 className="text-sm font-medium text-[#8B7E74] dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Current Tier</span>
                        <span className="text-xs font-normal text-[#5A524A] dark:text-gray-300 font-semibold">{TIER_CONFIGS_IMPORT[profile.tier]?.displayName || 'Atlas Free'}</span>
                      </h3>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-center">
                          <Crown className={`w-6 h-6 mb-2 ${
                            profile.tier === 'studio' ? 'text-yellow-500' :
                            profile.tier === 'core' ? 'text-[#8FA67E]' :
                            'text-[#8B7E74]'
                          }`} />
                        </div>
                        <div className="text-center">
                           <div className="font-semibold text-[#3B3632] dark:text-white">
                              {TIER_CONFIGS_IMPORT[profile.tier]?.displayName || 'Atlas Free'}
                            </div>
                            {TIER_CONFIGS_IMPORT[profile.tier]?.limits.text_messages_per_month === -1 ? (
                              <>
                               <div className="text-sm text-[#5A524A] dark:text-gray-300 font-medium">Unlimited Messages</div>
                                {profile.tier === 'studio' && (
                                 <div className="text-sm text-[#5A524A] dark:text-gray-300 font-medium">All features unlocked</div>
                                )}
                              </>
                            ) : (
                              <>
                               <div className="text-sm text-[#8B7E74] dark:text-gray-400">
                                  {profile.usage_stats?.text_messages_this_month || 0} / {TIER_CONFIGS_IMPORT[profile.tier]?.limits.text_messages_per_month || 15} messages
                                </div>
                               <div className="text-xs text-[#8B7E74]/70 dark:text-gray-500 mt-1">
                                  {TIER_CONFIGS_IMPORT[profile.tier]?.price || '$0/month'}
                                </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Emotional Insights */}
                   <div className="mt-4 p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-[#B8A5D6]/30 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-[#8B7AB8]" />
                        </div>
                       <h3 className="text-sm font-medium text-[#8B7E74] dark:text-gray-400 uppercase tracking-wider">Emotional Insights</h3>
                      </div>
                     <div className="text-sm text-[#5A524A] dark:text-gray-500 text-center py-8">
                      Track your emotional patterns and conversation insights
                    </div>
                  </div>
                </div>
              )}
              
              {/* Mode Selection */}
              <div className="p-4">
                 <h3 className="text-sm font-medium text-atlas-stone/70 dark:text-gray-400 uppercase tracking-wider mb-3">Mode</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => handleModeChange('text')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      currentMode === 'text' 
                        ? 'bg-atlas-sage/25 text-atlas-stone border border-atlas-sage/40 shadow-sm' 
                        : 'text-atlas-stone/70 hover:bg-atlas-sand/20 border border-transparent'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-medium">Text Mode</span>
                  </button>
                  
                  <button
                    onClick={() => handleModeChange('voice')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      currentMode === 'voice' 
                        ? 'bg-atlas-sage/25 text-atlas-stone border border-atlas-sage/40 shadow-sm' 
                        : 'text-atlas-stone/70 hover:bg-atlas-sand/20 border border-transparent'
                    }`}
                  >
                    <Headphones className="w-5 h-5" />
                    <span className="font-medium">Voice Mode</span>
                  </button>
                  
                  <button
                    onClick={() => handleModeChange('image')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      currentMode === 'image' 
                        ? 'bg-atlas-sage/25 text-atlas-stone border border-atlas-sage/40 shadow-sm' 
                        : 'text-atlas-stone/70 hover:bg-atlas-sand/20 border border-transparent'
                    }`}
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="font-medium">Image Mode</span>
                  </button>
                </div>
              </div>
              
              {/* Usage Stats */}
              {profile && (
                <div className="p-4">
                   <h3 className="text-sm font-medium text-atlas-stone/70 dark:text-gray-400 uppercase tracking-wider mb-3">Usage</h3>
                  
                  <div className="space-y-3">
                    {/* Requests */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2 text-atlas-stone/70">
                          <MessageSquare className="w-4 h-4" />
                          <span>Requests</span>
                        </div>
                        <span className="text-atlas-stone font-medium">
                          {profile.usage_stats.requests_this_month}/
                          {TIER_CONFIGS_IMPORT[profile.tier].limits.requests_per_month === -1 
                            ? '∞' 
                            : TIER_CONFIGS_IMPORT[profile.tier].limits.requests_per_month}
                        </span>
                      </div>
                      <div className="h-2 bg-atlas-sand/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-atlas-sage rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${TIER_CONFIGS_IMPORT[profile.tier].limits.requests_per_month === -1 
                              ? 10 
                              : Math.min(100, (profile.usage_stats.requests_this_month / TIER_CONFIGS_IMPORT[profile.tier].limits.requests_per_month) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Audio */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2 text-atlas-stone/70">
                          <Clock className="w-4 h-4" />
                          <span>Audio</span>
                        </div>
                        <span className="text-atlas-stone font-medium">
                          {profile.usage_stats.audio_minutes_this_month}/
                          {TIER_CONFIGS_IMPORT[profile.tier].limits.audio_minutes_per_month === -1 
                            ? '∞' 
                            : TIER_CONFIGS_IMPORT[profile.tier].limits.audio_minutes_per_month}
                        </span>
                      </div>
                      <div className="h-2 bg-atlas-sand/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-atlas-peach rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${TIER_CONFIGS_IMPORT[profile.tier].limits.audio_minutes_per_month === -1 
                              ? 10 
                              : Math.min(100, (profile.usage_stats.audio_minutes_this_month / TIER_CONFIGS_IMPORT[profile.tier].limits.audio_minutes_per_month) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Storage */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2 text-atlas-stone/70">
                          <HardDrive className="w-4 h-4" />
                          <span>Storage</span>
                        </div>
                        <span className="text-atlas-stone font-medium">
                          {profile.usage_stats.storage_used_mb}/
                          {TIER_CONFIGS_IMPORT[profile.tier].limits.storage_limit_mb} MB
                        </span>
                      </div>
                      <div className="h-2 bg-atlas-sand/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-atlas-stone rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${Math.min(100, (profile.usage_stats.storage_used_mb / TIER_CONFIGS_IMPORT[profile.tier].limits.storage_limit_mb) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Quick Actions */}
              <div className="p-4">
                 <h3 className="text-sm font-medium text-[#8B7E74] dark:text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => handleAction(() => {
                      // ✅ FIX: Use React Router navigation instead of hard reload
                      navigate('/chat', { replace: true });
                    })}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white bg-[#8FA67E] hover:bg-[#7E9570] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                      <span className="text-xl text-white">+</span>
                    </div>
                    <span className="font-medium">Start New Chat</span>
                  </button>
                  
                  <button
                    onClick={() => handleAction(onShowConversationHistory)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#5A524A] bg-[#C6D4B0] hover:bg-[#B8C6A2] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#5A524A]/20 flex items-center justify-center">
                      <History className="w-4 h-4 text-[#5A524A]" />
                    </div>
                    <span className="font-medium">View History</span>
                  </button>
                  
                  <button
                    onClick={() => handleAction(onShowWidgets)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#5A524A] bg-[#E8D5C4] hover:bg-[#DFC9B6] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#5A524A]/20 flex items-center justify-center">
                      <Grid3X3 className="w-4 h-4 text-[#5A524A]" />
                    </div>
                    <span className="font-medium">Widget Dashboard</span>
                  </button>
                  
                  <button
                    onClick={() => handleAction(onShowHelp)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#5A524A] bg-[#F0E6DC] hover:bg-[#E8DDD2] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#5A524A]/20 flex items-center justify-center">
                      <HelpCircle className="w-4 h-4 text-[#5A524A]" />
                    </div>
                    <span className="font-medium">Help & Tips</span>
                  </button>
                </div>
              </div>
              
              {/* Theme Settings */}
              <div className="p-4">
                 <h3 className="text-sm font-medium text-[#8B7E74] dark:text-gray-400 uppercase tracking-wider mb-3">Theme</h3>
                <ThemeToggle 
                  themeMode={themeMode}
                  onThemeChange={onThemeChange}
                  onSoundPlay={onSoundPlay}
                  variant="menu-item"
                />
              </div>
              
              {/* Settings */}
              <div className="p-4">
                 <h3 className="text-sm font-medium text-[#8B7E74] dark:text-gray-400 uppercase tracking-wider mb-3">Settings</h3>
                <div className="space-y-3">
                  {/* Audio Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-atlas-stone/70" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-atlas-stone/70" />
                      )}
                      <span className="text-atlas-stone">Audio Responses</span>
                    </div>
                    <button
                      onClick={handleMuteToggle}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shadow-sm ${
                        isMuted ? 'bg-atlas-sand' : 'bg-atlas-sage'
                      }`}
                      role="switch"
                      aria-checked={!isMuted}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                          isMuted ? 'translate-x-1' : 'translate-x-6'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {/* Connection Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {connectionStatus === 'online' ? (
                        <Wifi className="w-5 h-5 text-atlas-stone/70" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-atlas-stone/70" />
                      )}
                      <span className="text-atlas-stone">Connection</span>
                    </div>
                    <button
                      onClick={() => handleAction(onShowSpeedTest)}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-atlas-sand/30 transition-colors"
                    >
                      <StatusIndicator 
                        status={connectionStatus} 
                        size="sm"
                      />
                      <span className="text-sm text-atlas-stone/70">Check</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 mt-auto">
              <button
                onClick={() => handleAction(onLogout)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#E8D5C4]/40 hover:bg-[#E8D5C4]/60 text-[#5A524A] rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
              
              {/* Version Info */}
               <div className="mt-3 text-center text-xs text-[#8B7E74]/50 dark:text-gray-500">
                Atlas 2.0 • Version 2025.06.1
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SideMenu;
