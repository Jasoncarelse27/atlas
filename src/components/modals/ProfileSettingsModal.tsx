import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Eye, Lock, LogOut, Minimize2, Moon, Sparkles, Volume2, X } from 'lucide-react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useSettingsStore } from '../../stores/useSettingsStore';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export function ProfileSettingsModal({ isOpen, onClose, onSignOut }: ProfileSettingsModalProps) {
  const { user, tier } = useSupabaseAuth();
  const {
    theme,
    privacyMode,
    reduceMotion,
    increaseContrast,
    screenReader,
    toggleTheme,
    togglePrivacy,
    toggleReduceMotion,
    toggleIncreaseContrast,
    toggleScreenReader,
  } = useSettingsStore();

  const getTierDisplay = (tier: string) => {
    switch (tier) {
      case 'studio': return 'Atlas Studio';
      case 'core': return 'Atlas Core';
      case 'free': return 'Atlas Free';
      default: return 'Atlas Free';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-md bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-slate-700/50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#B2BDA3] to-[#F4E5D9] flex items-center justify-center text-2xl font-semibold text-gray-900">
                      {user?.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Profile</h2>
                      <p className="text-sm text-slate-400">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                    aria-label="Close profile"
                  >
                    <X className="w-5 h-5 text-slate-300" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Appearance Section */}
                <Section title="Appearance">
                  <ToggleItem
                    icon={<Moon className="w-5 h-5" />}
                    label="Dark Mode"
                    description="Switch between light and dark themes"
                    checked={theme === 'dark'}
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
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-700/20 border border-slate-600/20">
                    <div>
                      <p className="text-sm font-medium text-white">Subscription Tier</p>
                      <p className="text-xs text-slate-400 mt-1">{getTierDisplay(tier)}</p>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30">
                      <span className="text-xs font-semibold text-purple-400">{tier?.toUpperCase() || 'FREE'}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={onSignOut}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 hover:border-red-500/40 transition-all"
                  >
                    <LogOut className="w-5 h-5 text-red-400" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Sign Out</p>
                      <p className="text-xs text-slate-400">End your session</p>
                    </div>
                  </button>
                </Section>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Helper components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
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
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl bg-slate-700/20 border border-slate-600/20 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 flex-1">
        <div className="text-slate-400">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">{label}</p>
            {comingSoon && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-600/20 text-blue-400 rounded-full border border-blue-500/30">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
      </label>
    </div>
  );
}

function PlaceholderCard({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-700/10 border border-slate-600/10 border-dashed opacity-60">
      <div className="text-slate-500">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-300">{label}</p>
          <span className="px-2 py-0.5 text-xs font-medium bg-amber-600/20 text-amber-400 rounded-full border border-amber-500/30">
            Coming Soon
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

