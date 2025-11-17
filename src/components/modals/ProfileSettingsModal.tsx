import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Eye, Loader2, Lock, LogOut, Minimize2, Moon, Sparkles, Trash2, Volume2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useThemeMode } from '../../hooks/useThemeMode';
import { logger } from '../../lib/logger';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { ConfirmDialog } from './ConfirmDialog';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export function ProfileSettingsModal({ isOpen, onClose, onSignOut }: ProfileSettingsModalProps) {
  const { user, tier } = useSupabaseAuth();
  
  // ✅ FIX: Use useThemeMode for theme (single source of truth - syncs DOM + DB)
  const { isDarkMode, toggleTheme } = useThemeMode();
  
  // ✅ FIX: Force re-render when theme changes (ensures toggle switch updates visually)
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const handleThemeChange = () => {
      forceUpdate({});
    };
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);
  
  // Keep other settings from useSettingsStore (privacy, accessibility)
  const {
    privacyMode,
    reduceMotion,
    increaseContrast,
    screenReader,
    togglePrivacy,
    toggleReduceMotion,
    toggleIncreaseContrast,
    toggleScreenReader,
  } = useSettingsStore();
  
  // ✅ Clear All Data state
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);

  const getTierDisplay = (tier: string) => {
    switch (tier) {
      case 'studio': return 'Atlas Studio';
      case 'core': return 'Atlas Core';
      case 'free': return 'Atlas Free';
      default: return 'Atlas Free';
    }
  };

  const handleClearData = () => {
    setShowClearDataConfirm(true);
  };

  const confirmClearData = async () => {
    setShowClearDataConfirm(false);
    setIsClearingData(true);

    try {
      logger.debug('[ProfileSettings] Clearing all local data...');
      
      // Import and call resetLocalData utility
      const { resetLocalData } = await import('../../utils/resetLocalData');
      await resetLocalData();
      
    } catch (err) {
      logger.error('[ProfileSettings] Failed to clear data:', err);
      toast.error('Failed to clear data. Please try again.');
      setIsClearingData(false);
    }
    // Note: resetLocalData() will reload the page, so setIsClearingData won't run
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="profile-modal-root">
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-md bg-[#F9F6F3] dark:bg-gray-900 rounded-2xl shadow-2xl border border-[#E8DDD2] dark:border-gray-700 overflow-hidden transition-colors duration-200">
              {/* Header */}
              <div className="p-6 border-b border-[#E8DDD2] dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#B2BDA3] to-[#F4E5D9] dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-2xl font-semibold text-gray-900 dark:text-white">
                      {user?.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[#3B3632] dark:text-white">Profile</h2>
                      <p className="text-sm text-[#8B7E74] dark:text-gray-400">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl bg-[#F0E6DC] dark:bg-gray-700 hover:bg-[#E8DDD2] dark:hover:bg-gray-600 transition-colors"
                    aria-label="Close profile"
                  >
                    <X className="w-5 h-5 text-[#8B7E74] dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Appearance Section */}
                <Section title="Appearance">
                  <ToggleItem
                    key={`dark-mode-toggle-${isDarkMode}`}
                    icon={<Moon className="w-5 h-5" />}
                    label="Dark Mode"
                    description="Switch between light and dark themes"
                    checked={isDarkMode}
                    onChange={toggleTheme}
                  />
                </Section>

                {/* Accessibility Section */}
                <Section title="Accessibility">
                  <ToggleItem
                    icon={<Minimize2 className="w-5 h-5" />}
                    label="Reduce Motion"
                    description="Minimize animations"
                    checked={reduceMotion}
                    onChange={toggleReduceMotion}
                    disabled
                    comingSoon
                  />
                  <ToggleItem
                    icon={<Eye className="w-5 h-5" />}
                    label="Increase Contrast"
                    description="Improve color clarity"
                    checked={increaseContrast}
                    onChange={toggleIncreaseContrast}
                    disabled
                    comingSoon
                  />
                  <ToggleItem
                    icon={<Volume2 className="w-5 h-5" />}
                    label="Screen Reader"
                    description="Enable screen reader support"
                    checked={screenReader}
                    onChange={toggleScreenReader}
                    disabled
                    comingSoon
                  />
                </Section>

                {/* Privacy Section */}
                <Section title="Privacy">
                  <ToggleItem
                    icon={<Lock className="w-5 h-5" />}
                    label="Privacy Mode"
                    description="Enhanced data protection"
                    checked={privacyMode}
                    onChange={togglePrivacy}
                  />
                </Section>

                {/* Emotional Features Section */}
                <Section title="Emotional Features">
                  <PlaceholderCard
                    icon={<Sparkles className="w-5 h-5" />}
                    label="Ritual Builder"
                    description="Design morning, evening, or focus rituals"
                  />
                  <PlaceholderCard
                    icon={<Calendar className="w-5 h-5" />}
                    label="Emotional Tracker"
                    description="Track your habits and emotional patterns"
                  />
                </Section>

                {/* Account Section */}
                <Section title="Account">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-gray-800 border border-[#E8DDD2] dark:border-gray-700 transition-colors duration-200">
                    <div>
                      <p className="text-sm font-medium text-[#3B3632] dark:text-white">Subscription Tier</p>
                      <p className="text-xs text-[#8B7E74] dark:text-gray-400 mt-1">{getTierDisplay(tier)}</p>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-[#B8A5D6]/20 border border-[#B8A5D6]/30">
                      <span className="text-xs font-semibold text-[#8B7AB8]">{tier?.toUpperCase() || 'FREE'}</span>
                    </div>
                  </div>
                  
                  {/* ✅ Clear All Data - Smaller button below subscription tier */}
                  <button
                    onClick={handleClearData}
                    disabled={isClearingData}
                    aria-label="Clear all local data (conversations and cache will be removed)"
                    aria-busy={isClearingData}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#8B7E74] bg-[#F0E6DC]/50 hover:bg-[#F0E6DC] border border-[#E8DDD2] hover:border-[#CF9A96]/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isClearingData ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#A67571] animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-[#A67571]" />
                    )}
                    <span className="font-medium">{isClearingData ? 'Clearing...' : 'Clear All Data'}</span>
                  </button>
                  
                  <button
                    onClick={onSignOut}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#CF9A96]/10 hover:bg-[#CF9A96]/20 border border-[#CF9A96]/20 hover:border-[#CF9A96]/40 transition-all"
                  >
                    <LogOut className="w-5 h-5 text-[#A67571]" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-[#3B3632] dark:text-white">Sign Out</p>
                      <p className="text-xs text-[#8B7E74] dark:text-gray-400">End your session</p>
                    </div>
                  </button>
                </Section>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      
      {/* ✅ Clear All Data Confirmation Dialog */}
      {showClearDataConfirm && (
        <ConfirmDialog
          key="confirm-dialog"
          isOpen={showClearDataConfirm}
          onClose={() => setShowClearDataConfirm(false)}
          onConfirm={confirmClearData}
          title="Clear All Data"
          message="This will clear all local conversations and cache. Your account data is safe on the server. This action cannot be undone."
          confirmLabel="Clear All Data"
          cancelLabel="Cancel"
          variant="destructive"
          isLoading={isClearingData}
        />
      )}
    </AnimatePresence>
  );
}

// Helper components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-[#8B7E74] dark:text-gray-400 uppercase tracking-wider">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface ToggleItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

function ToggleItem({ icon, label, description, checked, onChange, disabled, comingSoon }: ToggleItemProps) {
  // ✅ FIX: Use local state to ensure checkbox updates immediately
  const [isChecked, setIsChecked] = React.useState(checked);
  
  // ✅ FIX: Sync local state with prop changes
  useEffect(() => {
    setIsChecked(checked);
  }, [checked]);
  
  // ✅ BEST PRACTICE: Handle toggle via onChange only (let browser handle click/touch naturally)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ✅ BEST PRACTICE: Don't prevent default - let checkbox handle its own state
    if (!disabled && !comingSoon) {
      const newChecked = e.target.checked;
      setIsChecked(newChecked); // Update local state immediately
      logger.debug(`[ToggleItem] Toggle changed for ${label}, calling onChange`);
      onChange();
    }
  };

  // ✅ BEST PRACTICE: Handle label click separately (prevents double-firing)
  const handleLabelClick = (e: React.MouseEvent<HTMLLabelElement>) => {
    // Only prevent default if disabled/coming soon (prevents checkbox activation)
    if (disabled || comingSoon) {
      e.preventDefault();
    }
    // Otherwise, let the label's natural behavior trigger the input
  };

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl bg-white dark:bg-gray-800 border border-[#E8DDD2] dark:border-gray-700 transition-colors duration-200 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 flex-1">
        <div className="text-[#8B7E74] dark:text-gray-400">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[#3B3632] dark:text-white">{label}</p>
            {comingSoon && (
              <span className="px-2 py-0.5 text-xs font-medium bg-[#8FA67E]/20 text-[#8FA67E] rounded-full border border-[#8FA67E]/30">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-xs text-[#8B7E74] dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      
      <label 
        className="relative inline-flex items-center cursor-pointer"
        onClick={handleLabelClick}
        htmlFor={`toggle-${label.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <input
          id={`toggle-${label.replace(/\s+/g, '-').toLowerCase()}`}
          type="checkbox"
          checked={isChecked}
          onChange={handleChange}
          disabled={disabled || comingSoon}
          className="sr-only peer"
          aria-label={label}
          aria-describedby={`toggle-desc-${label.replace(/\s+/g, '-').toLowerCase()}`}
          role="switch"
          aria-checked={isChecked}
        />
        <div className={`w-11 h-6 rounded-full transition-all duration-200 ${
          isChecked 
            ? 'bg-[#8FA67E] dark:bg-gray-600' 
            : 'bg-[#E8DDD2] dark:bg-gray-700'
        } peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#8FA67E]/20 dark:peer-focus:ring-gray-500/20 peer-focus-visible:ring-4 peer-focus-visible:ring-[#8FA67E]/20 dark:peer-focus-visible:ring-gray-500/20 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-gray-200 after:border-[#E8DDD2] dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
          isChecked ? 'after:translate-x-full' : 'after:translate-x-0'
        } disabled:opacity-50 disabled:cursor-not-allowed`}></div>
        <span id={`toggle-desc-${label.replace(/\s+/g, '-').toLowerCase()}`} className="sr-only">{description}</span>
      </label>
    </div>
  );
}

function PlaceholderCard({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-[#F0E6DC]/50 border border-[#E8DDD2] border-dashed opacity-60">
      <div className="text-[#B8A9A0]">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#8B7E74]">{label}</p>
          <span className="px-2 py-0.5 text-xs font-medium bg-[#F3B562]/20 text-[#F3B562] rounded-full border border-[#F3B562]/30">
            Coming Soon
          </span>
        </div>
        <p className="text-xs text-[#B8A9A0] mt-0.5">{description}</p>
      </div>
    </div>
  );
}

