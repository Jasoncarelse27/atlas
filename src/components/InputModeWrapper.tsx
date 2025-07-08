import React from 'react';

interface InputModeWrapperProps {
  children: React.ReactNode;
  className?: string;
}

const InputModeWrapper: React.FC<InputModeWrapperProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`w-full neumorphic-card p-3 sm:p-4 md:p-6 transition-all duration-300 ease-in-out relative ${className}`}>
      {children}
    </div>
  );
};

export default InputModeWrapper;