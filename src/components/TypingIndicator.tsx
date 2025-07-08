import React, { useState, useEffect } from 'react';
import { MessageSquare, Bot, User } from 'lucide-react';

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
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        );
      
      case 'pulse':
        return (
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-3 h-3 bg-blue-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        );
      
      default: // dots
        return (
          <div className="flex space-x-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i <= dotCount ? 'bg-blue-500 scale-100' : 'bg-gray-300 scale-75'
                }`}
              />
            ))}
          </div>
        );
    }
  };

  return (
    <div className={`flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 ${className}`}>
      <div className="p-2 bg-blue-100 rounded-full">
        <Bot className="w-4 h-4 text-blue-600" />
      </div>
      
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-blue-800">{message}</span>
          {renderVariant()}
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;