import React, { useState } from 'react';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { useTierAccess } from '../hooks/useTierAccess';
import { fastspringService } from '../services/fastspringService';

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
  const { user } = useSupabaseAuth();
  const { showUpgradeModal } = useTierAccess();
  const [isLoading, setIsLoading] = useState(false);

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
        return 'bg-atlas-stone hover:bg-atlas-stone/80 text-white';
      case 'outline':
        return 'border-2 border-atlas-sage text-gray-800 hover:bg-atlas-sage hover:text-gray-900';
      default:
        return 'bg-atlas-sage hover:bg-atlas-success text-gray-800 font-semibold';
    }
  };

  const handleUpgrade = async () => {
    if (!user?.id || !user?.email) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Default to Core tier for upgrade
      const tier = 'core';
      const checkoutUrl = await fastspringService.createCheckoutUrl(user.id, tier, user.email);
      
      // Redirect to FastSpring checkout
      window.location.href = checkoutUrl;
      
    } catch (error) {
      // Fallback to showing upgrade modal
      showUpgradeModal('subscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleUpgrade}
      disabled={isLoading}
      className={`
        ${getSizeStyles()}
        ${getVariantStyles()}
        rounded-lg shadow-md hover:shadow-lg 
        transition-all duration-200 
        font-medium
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
}
