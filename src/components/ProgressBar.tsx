import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  showPercentage?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  size = 'md',
  color = 'primary',
  showPercentage = false,
  label,
  animated = false,
  className = ''
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'h-1';
      case 'md': return 'h-2';
      case 'lg': return 'h-3';
      default: return 'h-2';
    }
  };

  const getColorClasses = () => {
    switch (color) {
      case 'primary': return 'bg-atlas-sage';      // Atlas sage
      case 'secondary': return 'bg-atlas-stone';   // Atlas stone
      case 'success': return 'bg-atlas-success';   // Muted sage green
      case 'warning': return 'bg-atlas-warning';   // Warm gold
      case 'error': return 'bg-atlas-error';       // Muted rose
      default: return 'bg-atlas-sage';             // Atlas sage default
    }
  };

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm text-gray-700">{label}</span>}
          {showPercentage && <span className="text-sm text-gray-700">{Math.round(clampedProgress)}%</span>}
        </div>
      )}
      
      <div className="neumorphic-progress-container">
        <div
          className={`neumorphic-progress-fill ${animated ? 'animate-pulse' : ''}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;