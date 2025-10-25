import React from 'react';

interface SystemMessageProps {
  text: string;
  action?: React.ReactNode;
  type?: 'info' | 'warning' | 'error' | 'success';
}

export default function SystemMessage({ text, action, type = 'info' }: SystemMessageProps) {
  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return 'bg-[#F3B562]/10 border-[#F3B562]/30 text-[#F3B562]';
      case 'error':
        return 'bg-[#CF9A96]/10 border-[#CF9A96]/30 text-[#A67571]';
      case 'success':
        return 'bg-[#8FA67E]/10 border-[#8FA67E]/30 text-[#8FA67E]';
      default:
        return 'bg-[#F0E6DC] border-[#E8DDD2] text-[#5A524A]';
    }
  };

  return (
    <div className="flex justify-center my-3">
      <div className={`${getTypeStyles()} text-sm px-4 py-3 rounded-xl shadow-md max-w-md text-center border`}>
        <p className="font-medium">{text}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
