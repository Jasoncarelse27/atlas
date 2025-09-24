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
        return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-200';
      case 'error':
        return 'bg-red-900/20 border-red-500/30 text-red-200';
      case 'success':
        return 'bg-green-900/20 border-green-500/30 text-green-200';
      default:
        return 'bg-[#2c2f36] border-gray-600/30 text-gray-200';
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
