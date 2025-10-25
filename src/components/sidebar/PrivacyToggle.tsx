import { Check, Shield } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';

export default function PrivacyToggle() {
  const { privacyMode, togglePrivacy } = useSettingsStore();

  return (
    <div className="bg-white/50 border border-[#E8DDD2] p-4 rounded-xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-[#8FA67E]/20">
            <Shield className="w-5 h-5 text-[#8FA67E]" />
          </div>
          <div>
            <span className="text-[#5A524A] text-sm font-medium">Privacy Mode</span>
            <p className="text-[#8B7E74] text-xs">Enhanced data protection</p>
          </div>
        </div>
        
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={privacyMode}
            onChange={togglePrivacy}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-[#E8DDD2] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#8FA67E]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#E8DDD2] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA67E]"></div>
        </label>
      </div>
      
      {privacyMode && (
        <div className="mt-3 p-3 bg-[#8FA67E]/10 border border-[#8FA67E]/30 rounded-xl flex items-center gap-2">
          <div className="p-1 rounded-lg bg-[#8FA67E]/20">
            <Check className="w-4 h-4 text-[#8FA67E]" />
          </div>
          <p className="text-[#5A524A] text-xs font-medium">
            Enhanced privacy protection active
          </p>
        </div>
      )}
    </div>
  );
}
