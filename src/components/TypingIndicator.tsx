import { Bot } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface TypingIndicatorProps {
  isVisible: boolean;
  message?: string;
  variant?: 'dots' | 'wave' | 'pulse';
  className?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  isVisible,
  message = "Atlas is thinking...",
  variant = 'dots',
  className = ''
}) => {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setDotCount(prev => (prev % 3) + 1);
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const renderVariant = () => {
    switch (variant) {
      case 'wave':
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-atlas-sage rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        );
      
      case 'pulse':
        return (
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-atlas-sage rounded-full animate-pulse" />
            <div className="w-3 h-3 bg-[#D3DCAB] rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-3 h-3 bg-[#F3D3B8] rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        );
      
      default: // dots
        return (
          <div className="flex space-x-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i <= dotCount ? 'bg-atlas-sage scale-100' : 'bg-[#CEC1B8] scale-75'
                }`}
              />
            ))}
          </div>
        );
    }
  };

  return (
    <div className={`flex items-center space-x-3 p-4 bg-gradient-to-r from-[#F4E8E1] to-[#F3D3B8] rounded-lg border border-[#CEC1B8] ${className}`}>
      <div className="p-2 bg-[#D3DCAB]/20 rounded-full">
        <Bot className="w-4 h-4 text-atlas-sage" />
      </div>
      
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-800">{message}</span>
          {renderVariant()}
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;