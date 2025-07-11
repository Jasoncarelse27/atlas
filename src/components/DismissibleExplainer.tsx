import React from 'react';
import { X } from 'lucide-react';
import { useDismissibleState } from '../hooks/useLocalStorage';
import type { SoundType } from '../hooks/useSoundEffects';

interface DismissibleExplainerProps {
  id: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'info' | 'tip' | 'warning';
  onSoundPlay?: (soundType: SoundType) => void;
}

const DismissibleExplainer: React.FC<DismissibleExplainerProps> = ({
  id,
  title,
  children,
  className = '',
  variant = 'info',
  onSoundPlay
}) => {
  const [isDismissed, dismiss] = useDismissibleState(id);

  if (isDismissed) {
    return null;
  }

  const getVariantClasses = () => {
    switch (variant) {
      case 'tip':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'info':
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const handleDismiss = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    dismiss();
  };

  return (
    <div className={`relative p-3 sm:p-4 rounded-2xl border ${getVariantClasses()} ${className} neumorphic-card`}>
      <button
        onClick={handleDismiss}
        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3 sm:w-4 sm:h-4" />
      </button>
      
      {title && (
        <h4 className="font-medium mb-1.5 sm:mb-2 pr-6 text-xs sm:text-sm">{title}</h4>
      )}
      
      <div className="text-xs sm:text-sm">
        {children}
      </div>
    </div>
  );
};

export default DismissibleExplainer;