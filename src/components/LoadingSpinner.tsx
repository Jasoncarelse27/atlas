import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  text?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  color = 'primary', 
  text,
  className = '' 
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'w-4 h-4';
      case 'md': return 'w-6 h-6';
      case 'lg': return 'w-8 h-8';
      case 'xl': return 'w-12 h-12';
      default: return 'w-6 h-6';
    }
  };

  const getColorClasses = () => {
    switch (color) {
      case 'primary': return 'text-primary';
      case 'secondary': return 'text-gray-600';
      case 'white': return 'text-white';
      case 'gray': return 'text-gray-500';
      default: return 'text-primary';
    }
  };

  const getTextSizeClasses = () => {
    switch (size) {
      case 'sm': return 'text-sm';
      case 'md': return 'text-base';
      case 'lg': return 'text-lg';
      case 'xl': return 'text-xl';
      default: return 'text-base';
    }
  };

  return (
    <div className={`flex items-center justify-center min-h-screen bg-[#F9F6F3] space-x-2 ${className}`}>
      <Loader2 className={`animate-spin ${getSizeClasses()} ${getColorClasses()}`} />
      {text && (
        <span className={`${getColorClasses()} ${getTextSizeClasses()} font-medium`}>
          {text}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;
