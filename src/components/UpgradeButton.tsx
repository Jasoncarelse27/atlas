import React, { useState } from 'react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { useTierAccess } from '../hooks/useTierAccess';
import { logger } from '../lib/logger';
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
  const { tier, showUpgradeModal } = useTierAccess();
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
      toast.error('Please log in to upgrade');
      return;
    }

    setIsLoading(true);
    
    try {
      // ✅ TIER LOGIC: Check current tier and suggest appropriate upgrade
      let targetTier: 'core' | 'studio' = 'core';
      
      // If already on Core, suggest Studio
      if (tier === 'core') {
        targetTier = 'studio';
      }
      
      // Show loading toast
      const loadingToastId = toast.loading('Opening secure checkout...');
      
      // ✅ FASTSPRING PENDING: Check if FastSpring is approved
      try {
        const checkoutUrl = await fastspringService.createCheckoutUrl(user.id, targetTier, user.email);
      
      // Dismiss loading toast
        toast.dismiss(loadingToastId);
      
      // ✅ BEST PRACTICE: Log checkout URL for debugging
      logger.info('Redirecting to FastSpring checkout:', checkoutUrl);
      
      // Redirect to FastSpring checkout
      window.location.href = checkoutUrl;
      } catch (fastspringError) {
        // ✅ FASTSPRING PENDING: Show message if not approved yet
        toast.dismiss(loadingToastId);
        logger.warn('FastSpring checkout not available yet:', fastspringError);
        toast.info(
          'Checkout is being set up. Please check back soon or contact support for early access.',
          { duration: 5000 }
        );
        
        // Fallback to showing upgrade modal
        showUpgradeModal('subscription');
      }
      
    } catch (error) {
      logger.error('Upgrade error:', error);
      
      // ✅ BEST PRACTICE: User-friendly error with actionable guidance
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(
        `${errorMessage}\n\nPlease contact support if this persists.`,
        { duration: 5000 }
      );
      
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
