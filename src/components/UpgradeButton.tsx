import React from 'react';
import { useTierAccess } from '../hooks/useTierAccess';

interface UpgradeButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
  children?: React.ReactNode;
}

export function UpgradeButton({ 
  className = '', 
  size = 'md', 
  variant = 'primary',
  children = 'Upgrade Now'
}: UpgradeButtonProps) {
  const { showUpgradeModal } = useTierAccess();

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2 text-base';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-gray-600 hover:bg-gray-700 text-white';
      case 'outline':
        return 'border-2 border-indigo-500 text-indigo-400 hover:bg-indigo-500 hover:text-white';
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 text-white';
    }
  };

  return (
    <button
      onClick={showUpgradeModal}
      className={`
        ${getSizeStyles()}
        ${getVariantStyles()}
        rounded-lg shadow-md hover:shadow-lg 
        transition-all duration-200 
        font-medium
        ${className}
      `}
    >
      {children}
    </button>
  );
}
