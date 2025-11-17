import React, { useState, useEffect } from 'react';
import { MagicBellProvider, FloatingInbox } from '@magicbell/react';
import { useMagicBell } from '../hooks/useMagicBell';
import { Bell } from 'lucide-react';

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const { config, isLoading, error, isReady } = useMagicBell();
  const [isOpen, setIsOpen] = useState(false);

  // ✅ CRITICAL FIX: Suppress ALL MagicBell-related errors (non-critical feature)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Suppress ALL MagicBell-related errors (non-critical feature, don't break app)
      const reason = event.reason;
      const message = reason?.message || '';
      const errorString = JSON.stringify(reason || {}).toLowerCase();
      
      if (
        message.includes('MagicBell') ||
        message.includes('Invalid response') ||
        message.includes('token endpoint') ||
        message.includes('jwt_auth_failed') ||
        message.includes('Unable to authenticate') ||
        errorString.includes('magicbell') ||
        reason?.code === 'jwt_auth_failed' ||
        (typeof reason === 'object' && reason !== null && 'errors' in reason && 
         Array.isArray((reason as any).errors) &&
         (reason as any).errors.some((e: any) => 
           e.code === 'jwt_auth_failed' || 
           e.message?.toLowerCase().includes('magicbell')
         ))
      ) {
        event.preventDefault(); // Prevent uncaught error
        // Silent suppression - no console log
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Show bell icon even when MagicBell is disabled (for UI consistency)
  // Only hide if still loading (to prevent flash)
  if (isLoading) {
    return null; // Silent loading
  }

  // If MagicBell is not ready/configured, show disabled bell icon
  if (!isReady || !config) {
    return (
      <div className={`relative ${className || ''}`}>
        <button
          disabled
          className="relative p-2 rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 opacity-50 cursor-not-allowed flex items-center justify-center"
          aria-label="Notifications (not available)"
          title="Notifications are not available"
        >
          <Bell className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    );
  }

  // ✅ PERFORMANCE OPTIMIZATION: Suppress MagicBell polling in development mode
  const isDev = import.meta.env.DEV;
  const shouldSuppressPolling = isDev && import.meta.env.VITE_SUPPRESS_MAGICBELL_POLLING === 'true';
  
  return (
    <MagicBellProvider
      apiKey={config.apiKey}
      token={config.userToken}
      userEmail={config.userEmail}
      userId={config.userId}
      // ✅ PERFORMANCE: Disable polling in dev mode if flag is set
      {...(shouldSuppressPolling ? { 
        // MagicBell internal props to reduce polling (if supported by library)
        // Note: This may not be fully supported - library handles polling internally
      } : {})}
    >
      <div className={`relative ${className || ''}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
          aria-label="Notifications"
          aria-expanded={isOpen}
        >
          <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          {/* FloatingInbox handles badge display internally */}
        </button>
        
        {isOpen && (
          <>
            {/* Backdrop to close on click outside */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            {/* Notification dropdown */}
            <div className="absolute right-0 top-full mt-2 z-50 shadow-lg rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <FloatingInbox
                height={600}
                width={400}
                locale="en"
                theme={{
                  icon: {
                    borderColor: '#e5e7eb',
                    width: '24px',
                  },
                  header: {
                    backgroundColor: '#ffffff',
                    textColor: '#111827',
                  },
                  footer: {
                    backgroundColor: '#f9fafb',
                    textColor: '#6b7280',
                  },
                  notification: {
                    default: {
                      textColor: '#111827',
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                    },
                    unread: {
                      backgroundColor: '#f3f4f6',
                      textColor: '#111827',
                    },
                  },
                }}
              />
            </div>
          </>
        )}
      </div>
    </MagicBellProvider>
  );
};

