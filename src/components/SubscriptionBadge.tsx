import { Crown, Star, Zap } from 'lucide-react';
import React from 'react';
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
      case 'core':
        return <Zap className="w-3 h-3" />;
      case 'studio':
        return <Crown className="w-3 h-3" />;
      default:
        return <Star className="w-3 h-3" />;
    }
  };

  const getTierClasses = (tier: string) => {
    const baseClasses = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border';
    
    switch (tier) {
      case 'free':
        return `${baseClasses} bg-atlas-sand/20 border-atlas-sand text-gray-700`;
      case 'core':
        return `${baseClasses} bg-atlas-sage/30 border-atlas-sage text-gray-800`;
      case 'studio':
        return `${baseClasses} bg-gradient-to-r from-atlas-stone/20 to-atlas-stone/30 border-atlas-stone text-atlas-stone`;
      default:
        return `${baseClasses} bg-atlas-sand/20 border-atlas-sand text-gray-700`;
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