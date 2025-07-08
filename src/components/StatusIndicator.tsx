import React from 'react';
import { CheckCircle, AlertCircle, Clock, Wifi, WifiOff, Activity } from 'lucide-react';

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'connecting' | 'success' | 'error' | 'warning' | 'processing';
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  text,
  size = 'md',
  showIcon = true,
  showText = true,
  className = '',
  onClick
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          icon: Wifi,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          dotColor: 'bg-green-500',
          text: text || 'Online'
        };
      case 'offline':
        return {
          icon: WifiOff,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          dotColor: 'bg-red-500',
          text: text || 'Offline'
        };
      case 'connecting':
        return {
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          dotColor: 'bg-yellow-500',
          text: text || 'Connecting...'
        };
      case 'success':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          dotColor: 'bg-green-500',
          text: text || 'Success'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          dotColor: 'bg-red-500',
          text: text || 'Error'
        };
      case 'warning':
        return {
          icon: AlertCircle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          dotColor: 'bg-yellow-500',
          text: text || 'Warning'
        };
      case 'processing':
        return {
          icon: Activity,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          dotColor: 'bg-blue-500',
          text: text || 'Processing...'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          dotColor: 'bg-gray-500',
          text: text || 'Unknown'
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1 text-xs gap-1.5',
          icon: 'w-3 h-3',
          dot: 'w-2 h-2'
        };
      case 'md':
        return {
          container: 'px-3 py-1.5 text-sm gap-2',
          icon: 'w-4 h-4',
          dot: 'w-2.5 h-2.5'
        };
      case 'lg':
        return {
          container: 'px-4 py-2 text-base gap-2',
          icon: 'w-5 h-5',
          dot: 'w-3 h-3'
        };
      default:
        return {
          container: 'px-3 py-1.5 text-sm gap-2',
          icon: 'w-4 h-4',
          dot: 'w-2.5 h-2.5'
        };
    }
  };

  const config = getStatusConfig();
  const sizeClasses = getSizeClasses();
  const Icon = config.icon;

  // Responsive text visibility
  const textVisibility = showText ? 'hidden sm:inline' : 'hidden';

  // Add cursor-pointer if onClick is provided
  const cursorClass = onClick ? 'cursor-pointer hover:shadow-md' : '';

  return (
    <div 
      className={`inline-flex items-center rounded-full border backdrop-blur-sm ${config.bgColor} ${config.borderColor} ${sizeClasses.container} ${className} ${cursorClass} transition-all duration-200`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? `${config.text} - Click for network check` : undefined}
    >
      {showIcon && (
        <div className="relative flex items-center">
          {/* Status dot - always visible */}
          <div className={`${sizeClasses.dot} ${config.dotColor} rounded-full ${status === 'connecting' || status === 'processing' ? 'animate-pulse' : ''}`} />
          
          {/* Icon - hidden on mobile for space */}
          <Icon className={`${sizeClasses.icon} ${config.color} ${status === 'connecting' || status === 'processing' ? 'animate-pulse' : ''} hidden sm:block ml-1`} />
        </div>
      )}
      
      {/* Text - responsive visibility */}
      {showText && (
        <span className={`${config.color} font-medium ${textVisibility}`}>
          {config.text}
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;