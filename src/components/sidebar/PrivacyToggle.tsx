import { Check, Shield } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';

export default function PrivacyToggle() {
  const { privacyMode, togglePrivacy } = useSettingsStore();

  return (
    <div className="bg-slate-700/20 border border-slate-600/20 p-4 rounded-2xl shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-atlas-sage/20">
            <Shield className="w-5 h-5 text-atlas-sage" />
          </div>
          <div>
            <span className="text-white text-sm font-medium">Privacy Mode</span>
            <p className="text-slate-300 text-xs">Enhanced data protection</p>
          </div>
        </div>
        
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={privacyMode}
            onChange={togglePrivacy}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-atlas-sage"></div>
        </label>
      </div>
      
      {privacyMode && (
        <div className="mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-xl flex items-center gap-2">
          <div className="p-1 rounded-lg bg-green-600/20">
            <Check className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-green-200 text-xs font-medium">
            Enhanced privacy protection active
          </p>
        </div>
      )}
    </div>
  );
}
