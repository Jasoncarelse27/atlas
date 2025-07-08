import React from 'react';
import { Star } from 'lucide-react';
import useThemeMode from '../hooks/useThemeMode';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = '' }) => {
  const { isDarkMode } = useThemeMode();

  return (
    <div className={`flex items-center ${className}`}>
      <div className="relative">
        <div className="font-bold flex items-center">
          <Star className={`w-6 h-6 mr-1 ${
            isDarkMode 
              ? 'fill-blue-400 stroke-blue-400' 
              : 'fill-blue-500 stroke-blue-500'
          }`} />
          <span className={`text-xl tracking-wide text-transparent bg-clip-text ${
            isDarkMode
              ? 'bg-gradient-to-r from-blue-100 to-blue-400'
              : 'bg-gradient-to-r from-blue-600 to-blue-800'
          }`}>
            Atlas 2.0
          </span>
        </div>
      </div>
    </div>
  );
};

export default Logo;