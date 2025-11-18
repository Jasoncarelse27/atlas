import { Check, Shield } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';

export default function PrivacyToggle() {
  const { privacyMode, togglePrivacy } = useSettingsStore();

  return (
    <div className="bg-atlas-pearl/50 dark:bg-[#1A1D26]/80 border border-atlas-border dark:border-[#2A2E3A] p-4 rounded-xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-atlas-sage/20 dark:bg-[#F4E5D9]/20">
            <Shield className="w-5 h-5 text-atlas-sage dark:text-[#F4E5D9]" />
          </div>
          <div>
            <span className="text-atlas-text-dark dark:text-white text-sm font-medium">Privacy Mode</span>
            <p className="text-atlas-text-muted dark:text-gray-400 text-xs">Enhanced data protection</p>
          </div>
        </div>
        
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={privacyMode}
            onChange={togglePrivacy}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-atlas-border dark:bg-[#2A2E3A] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-atlas-sage/20 dark:peer-focus:ring-[#F4E5D9]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-atlas-border dark:after:border-[#2A2E3A] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-atlas-sage dark:peer-checked:bg-[#F4E5D9]"></div>
        </label>
      </div>
      
      {privacyMode && (
        <div className="mt-3 p-3 bg-atlas-sage/10 dark:bg-[#F4E5D9]/10 border border-atlas-sage/30 dark:border-[#F4E5D9]/30 rounded-xl flex items-center gap-2">
          <div className="p-1 rounded-lg bg-atlas-sage/20 dark:bg-[#F4E5D9]/20">
            <Check className="w-4 h-4 text-atlas-sage dark:text-[#F4E5D9]" />
          </div>
          <p className="text-atlas-text-dark dark:text-white text-xs font-medium">
            Enhanced privacy protection active
          </p>
        </div>
      )}
    </div>
  );
}
