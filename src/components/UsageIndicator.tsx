import React from 'react';
import { BarChart3, Clock, HardDrive, MessageSquare } from 'lucide-react';
import { UserProfile, TIER_CONFIGS } from '../types/subscription';
import ProgressBar from './ProgressBar';
import Tooltip from './Tooltip';

interface UsageIndicatorProps {
  profile: UserProfile;
  type: 'requests' | 'audio' | 'storage';
  className?: string;
  showLabel?: boolean;
}

const UsageIndicator: React.FC<UsageIndicatorProps> = ({ 
  profile, 
  type, 
  className = '',
  showLabel = true 
}) => {
  const tierConfig = TIER_CONFIGS[profile.tier];
  const usage = profile.usage_stats;

  const getUsageData = () => {
    switch (type) {
      case 'requests':
        return {
          current: usage.requests_this_month,
          limit: tierConfig.limits.requests_per_month,
          icon: MessageSquare,
          label: 'Requests',
          unit: 'requests'
        };
      case 'audio':
        return {
          current: usage.audio_minutes_this_month,
          limit: tierConfig.limits.audio_minutes_per_month,
          icon: Clock,
          label: 'Audio',
          unit: 'minutes'
        };
      case 'storage':
        return {
          current: usage.storage_used_mb,
          limit: tierConfig.limits.storage_limit_mb,
          icon: HardDrive,
          label: 'Storage',
          unit: 'MB'
        };
      default:
        return {
          current: 0,
          limit: 100,
          icon: BarChart3,
          label: 'Usage',
          unit: 'units'
        };
    }
  };

  const usageData = getUsageData();
  const Icon = usageData.icon;
  const isUnlimited = usageData.limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, (usageData.current / usageData.limit) * 100);
  
  const getProgressColor = () => {
    if (isUnlimited) return 'primary';
    if (percentage >= 90) return 'error';
    if (percentage >= 75) return 'warning';
    return 'primary';
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'MB' && value >= 1024) {
      return `${(value / 1024).toFixed(1)} GB`;
    }
    return `${value} ${unit}`;
  };

  const getTooltipContent = () => {
    if (isUnlimited) {
      return `${usageData.label}: ${formatValue(usageData.current, usageData.unit)} (Unlimited)`;
    }
    return `${usageData.label}: ${formatValue(usageData.current, usageData.unit)} / ${formatValue(usageData.limit, usageData.unit)}`;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Icon className="w-4 h-4" />
            <span>{usageData.label}</span>
          </div>
          <Tooltip content={getTooltipContent()} position="left">
            <span className="text-gray-700 font-medium">
              {isUnlimited ? (
                <span className="text-green-600">Unlimited</span>
              ) : (
                `${formatValue(usageData.current, usageData.unit)} / ${formatValue(usageData.limit, usageData.unit)}`
              )}
            </span>
          </Tooltip>
        </div>
      )}
      
      {!isUnlimited && (
        <ProgressBar
          progress={percentage}
          color={getProgressColor()}
          size="sm"
          animated={percentage >= 90}
        />
      )}
      
      {isUnlimited && (
        <div className="h-2 bg-gradient-to-r from-green-200 to-green-300 rounded-full relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-500 rounded-full animate-pulse opacity-50" />
        </div>
      )}
    </div>
  );
};

export default UsageIndicator;