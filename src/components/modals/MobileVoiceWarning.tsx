import { AlertTriangle, Wifi } from 'lucide-react';
import React from 'react';

interface MobileVoiceWarningProps {
  onClose: () => void;
}

export const MobileVoiceWarning: React.FC<MobileVoiceWarningProps> = ({ onClose }) => {
  const isHTTPS = window.location.protocol === 'https:';
  const isLocalNetwork = window.location.hostname.match(/^(192\.168\.|10\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[0-1]\.)/);
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-yellow-500/20 rounded-full">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
          </div>
          <h3 className="text-xl font-semibold text-white">Voice Calls on Mobile</h3>
        </div>
        
        <div className="space-y-4 text-gray-300">
          {!isHTTPS && isLocalNetwork && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Wifi className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-yellow-400">Insecure Connection Detected</p>
                  <p className="text-sm">
                    You're accessing Atlas over local network (HTTP). Voice calls require HTTPS on iOS Safari.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            <p className="font-medium text-white">For the best experience:</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-atlas-sage">•</span>
                <span>Use Atlas on desktop (Chrome, Firefox, Safari)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-atlas-sage">•</span>
                <span>Access Atlas via HTTPS (https://your-domain.com)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-atlas-sage">•</span>
                <span>Use localhost on desktop (http://localhost:5174)</span>
              </li>
            </ul>
          </div>
          
          <div className="pt-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
