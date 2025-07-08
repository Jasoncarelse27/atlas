import React from 'react';
import { Crown, Clock, Zap, Star } from 'lucide-react';
   import { UserProfile, TIER_CONFIGS } from "../types/subscription";
import Tooltip from '../components/Tooltip';

interface SubscriptionBadgeProps {
  profile: UserProfile;
  daysRemaining?: number | null;
  className?: string;
  showDetails?: boolean;
}

const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({ 
  profile, 
  daysRemaining, 
  className = '',
  showDetails = false 
}) => {
  const tierConfig = TIER_CONFIGS[profile.tier];
  
  const getBadgeIcon = () => {
    switch (profile.tier) {
      case 'basic':
        return <Clock className="w-3 h-3" />;
      case 'standard':
        return <Zap className="w-3 h-3" />;
      case 'pro':
        return <Crown className="w-3 h-3" />;
      default:
        return <Star className="w-3 h-3" />;
    }
  };

  const getTierClasses = (tier: string, isCurrentTier: boolean) => {
    const baseClasses = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border';
    
    switch (tier) {
      case 'basic':
        return `${baseClasses} bg-gray-100 border-gray-300 text-gray-700`;
      case 'standard':
        return `${baseClasses} bg-blue-100 border-blue-300 text-blue-700`;
      case 'pro':
        return `${baseClasses} bg-gradient-to-r from-purple-100 to-pink-100 border-purple-300 text-purple-700`;
      default:
        return `${baseClasses} bg-gray-100 border-gray-300 text-gray-700`;
    }
  };

  const getTooltipContent = () => {
    let content = `${tierConfig.displayName} Plan`;
    
    if (profile.tier === 'basic' && profile.subscription_status === 'trial' && daysRemaining !== null) {
      if (daysRemaining > 0) {
        content += ` • ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
      } else {
        content += ' • Trial expired';
      }
    }
    
    return content;
  };

  const getDisplayText = () => {
    if (showDetails) {
      if (profile.tier === 'basic' && profile.subscription_status === 'trial' && daysRemaining !== null) {
        if (daysRemaining > 0) {
          return `${tierConfig.displayName} (${daysRemaining}d left)`;
        } else {
          return `${tierConfig.displayName} (Expired)`;
        }
      }
    }
    
    return tierConfig.displayName;
  };

  return (
    <Tooltip content={getTooltipContent()} position="bottom">
      <div className={`subscription-badge-container ${getTierClasses(profile.tier, false)} ${className} min-w-[80px] flex-shrink-0`}>
        {getBadgeIcon()}
        <span className="whitespace-nowrap">{getDisplayText()}</span>
        {profile.tier === 'basic' && profile.subscription_status === 'trial' && daysRemaining !== null && daysRemaining <= 0 && (
          <div className="subscription-indicator-dot expired" />
        )}
      </div>
    </Tooltip>
  );
};

export default SubscriptionBadge;