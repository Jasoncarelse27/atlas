import React from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
import type { SoundType } from '../hooks/useSoundEffects';

interface ErrorMessageProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
  onRetry?: () => void;
  retryText?: string;
  className?: string;
  onSoundPlay?: (soundType: SoundType) => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  message,
  type = 'error',
  dismissible = false,
  onDismiss,
  onRetry,
  retryText = 'Try Again',
  className = '',
  onSoundPlay
}) => {
  // Play error sound when component mounts
  React.useEffect(() => {
    if (type === 'error' && onSoundPlay) {
      onSoundPlay('error');
    } else if (type === 'warning' && onSoundPlay) {
      onSoundPlay('notification');
    }
  }, [type, onSoundPlay]);

  const getTypeClasses = () => {
    switch (type) {
      case 'error':
        return {
          container: 'bg-red-50 border-red-200 text-red-800',
          icon: 'text-red-500',
          button: 'bg-red-100 hover:bg-red-200 border-red-300'
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          icon: 'text-yellow-500',
          button: 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300'
        };
      case 'info':
        return {
          container: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: 'text-blue-500',
          button: 'bg-blue-100 hover:bg-blue-200 border-blue-300'
        };
      default:
        return {
          container: 'bg-red-50 border-red-200 text-red-800',
          icon: 'text-red-500',
          button: 'bg-red-100 hover:bg-red-200 border-red-300'
        };
    }
  };

  const typeClasses = getTypeClasses();

  const handleRetry = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    if (onRetry) {
      onRetry();
    }
  };

  const handleDismiss = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${typeClasses.container} ${className}`}>
      <div className="flex items-start space-x-3">
        <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${typeClasses.icon}`} />
        
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="font-semibold mb-1">{title}</h3>
          )}
          <p className="text-sm leading-relaxed">{message}</p>
          
          {onRetry && (
            <button
              onClick={handleRetry}
              className={`mt-3 inline-flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${typeClasses.button}`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>{retryText}</span>
            </button>
          )}
        </div>
        
        {dismissible && onDismiss && (
          <button
            onClick={handleDismiss}
            className={`flex-shrink-0 p-1 rounded-md hover:bg-white/50 transition-colors ${typeClasses.icon}`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;