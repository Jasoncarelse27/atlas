import { Download, ExternalLink, FileText } from 'lucide-react';
import React from 'react';
import type { SoundType } from '../../../hooks/useSoundEffects';

interface PrivacyTabProps {
  onExportData: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const PrivacyTab: React.FC<PrivacyTabProps> = ({
  onExportData,
  onSoundPlay,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy & Data</h3>
        
        <div className="space-y-6">
          {/* Data Export */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Download className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-2">Export Your Data</h4>
                <p className="text-sm text-blue-800 mb-3">
                  Download a copy of all your data including conversations, settings, and profile information.
                </p>
                <button
                  onClick={() => {
                    if (onSoundPlay) {
                      onSoundPlay('click');
                    }
                    onExportData();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Data
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Policy */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-2">Privacy Policy</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Learn how we collect, use, and protect your personal information.
                </p>
                <button
                  onClick={() => {
                    if (onSoundPlay) {
                      onSoundPlay('click');
                    }
                    window.open('/privacy', '_blank');
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  Read Privacy Policy
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Data Usage */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center mt-0.5">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-green-900 mb-2">Data Usage</h4>
                <p className="text-sm text-green-800">
                  We only use your data to provide and improve our services. We never sell your personal information to third parties.
                </p>
              </div>
            </div>
          </div>

          {/* Data Retention */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-yellow-600 rounded-full flex items-center justify-center mt-0.5">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-yellow-900 mb-2">Data Retention</h4>
                <p className="text-sm text-yellow-800">
                  Your data is retained for as long as your account is active. You can request deletion at any time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyTab;
