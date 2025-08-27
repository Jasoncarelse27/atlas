import React from 'react';
import { Zap, Crown, Star } from 'lucide-react';
import type { UserProfile } from '../types/subscription';
import { TIER_CONFIGS } from '../types/subscription';
import Tooltip from './Tooltip';

interface SubscriptionBadgeProps {
  profile: UserProfile;
  className?: string;
  showDetails?: boolean;
}

const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({ 
  profile, 
  className = '',
  showDetails = false 
}) => {
  const tierConfig = TIER_CONFIGS[profile.tier];
  
  const getBadgeIcon = () => {
    switch (profile.tier) {
      case 'free':
        return <Star className="w-3 h-3" />;
      case 'pro':
        return <Zap className="w-3 h-3" />;
      case 'pro_max':
        return <Crown className="w-3 h-3" />;
      default:
        return <Star className="w-3 h-3" />;
    }
  };

  const getTierClasses = (tier: string) => {
    const baseClasses = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border';
    
    switch (tier) {
      case 'free':
        return `${baseClasses} bg-gray-100 border-gray-300 text-gray-700`;
      case 'pro':
        return `${baseClasses} bg-blue-100 border-blue-300 text-blue-700`;
      case 'pro_max':
        return `${baseClasses} bg-gradient-to-r from-purple-100 to-pink-100 border-purple-300 text-purple-700`;
      default:
        return `${baseClasses} bg-gray-100 border-gray-300 text-gray-700`;
    }
  };

  const getTooltipContent = () => {
    let content = `${tierConfig.displayName} Plan`;
    
    if (profile.tier === 'free') {
      content += ' • Always-on access';
    } else if (profile.subscription_status === 'active') {
      content += ' • Active subscription';
    }
    
    return content;
  };

  const getDisplayText = () => {
    if (showDetails) {
      return tierConfig.displayName;
    }
    
    return tierConfig.displayName;
  };

  return (
    <Tooltip content={getTooltipContent()} position="top">
      <div className={`${getTierClasses(profile.tier)} ${className}`}>
        {getBadgeIcon()}
        <span>{getDisplayText()}</span>
      </div>
    </Tooltip>
  );
};

export default SubscriptionBadge;