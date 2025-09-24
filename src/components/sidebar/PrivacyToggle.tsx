import React, { useState } from 'react';

export default function PrivacyToggle() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="bg-[#2c2f36] p-4 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🔒</span>
          <div>
            <span className="text-gray-200 text-sm font-medium">Privacy Mode</span>
            <p className="text-gray-400 text-xs">Enhanced data protection</p>
          </div>
        </div>
        
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => setEnabled(!enabled)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      {enabled && (
        <div className="mt-3 p-2 bg-green-900/20 border border-green-500/30 rounded-md">
          <p className="text-green-200 text-xs">
            ✓ Enhanced privacy protection active
          </p>
        </div>
      )}
    </div>
  );
}
