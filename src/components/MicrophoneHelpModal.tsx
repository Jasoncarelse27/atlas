// src/components/MicrophoneHelpModal.tsx
// Dedicated help modal for microphone permission failures
// Provides clear, platform-specific instructions for enabling microphone access

import React from 'react';
import { AlertTriangle, Settings } from 'lucide-react';

interface MicrophoneHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform?: 'ios' | 'android' | 'desktop';
}

export const MicrophoneHelpModal: React.FC<MicrophoneHelpModalProps> = ({
  isOpen,
  onClose,
  platform,
}) => {
  if (!isOpen) return null;

  // Detect platform if not provided
  const detectedPlatform = platform || (() => {
    if (typeof window === 'undefined') return 'desktop';
    const userAgent = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
    if (/Android/i.test(userAgent)) return 'android';
    return 'desktop';
  })();

  // Platform-specific instructions
  const getInstructions = () => {
    switch (detectedPlatform) {
      case 'ios':
        return [
          'Tap the lock icon in your browser\'s address bar',
          'Find "Microphone" in the permissions list',
          'Set it to "Allow"',
          'Refresh this page and try starting a call again',
        ];
      case 'android':
        return [
          'Tap the lock icon or "Site settings" in your browser\'s address bar',
          'Find "Microphone" in the permissions list',
          'Set it to "Allow"',
          'Refresh this page and try starting a call again',
        ];
      default: // Desktop (Chrome, Firefox, Safari, Edge)
        return [
          'Click the lock icon in your browser\'s address bar',
          'Find "Microphone" and set it to "Allow"',
          'Refresh this page and try starting a call again',
        ];
    }
  };

  const steps = getInstructions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-w-md rounded-xl bg-slate-900 p-6 text-slate-100 shadow-xl border border-slate-700 mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/20 rounded-full">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold">Microphone access blocked</h2>
        </div>

        <p className="mb-3 text-sm text-slate-300">
          Atlas needs access to your microphone for voice calls. It looks like your browser has blocked this permission.
        </p>

        <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-2 font-medium">How to enable microphone access:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-xs mb-4">
          <Settings className="w-4 h-4" />
          <p>After enabling, refresh the page and try again</p>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

