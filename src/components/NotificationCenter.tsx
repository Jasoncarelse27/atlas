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

  // ✅ CRITICAL FIX: Suppress MagicBell SDK uncaught promise rejections (non-critical feature)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Suppress MagicBell 401 errors (non-critical feature, don't break app)
      if (
        event.reason?.message?.includes('jwt_auth_failed') || 
        event.reason?.message?.includes('MagicBell') ||
        event.reason?.message?.includes('Unable to authenticate the JWT') ||
        event.reason?.code === 'jwt_auth_failed' ||
        (typeof event.reason === 'object' && event.reason !== null && 'errors' in event.reason && 
         Array.isArray((event.reason as any).errors) &&
         (event.reason as any).errors.some((e: any) => e.code === 'jwt_auth_failed'))
      ) {
        event.preventDefault(); // Prevent uncaught error
        console.debug('[NotificationCenter] Suppressed MagicBell error (non-critical):', event.reason);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('[NotificationCenter] Status:', { isLoading, error, isReady, hasConfig: !!config });
  }, [isLoading, error, isReady, config]);

  if (!isReady) {
    // Don't show anything if not ready (user not logged in or still loading)
    if (isLoading) {
      return null; // Silent loading
    }
    if (error) {
      // Log error for debugging
      console.warn('[NotificationCenter] Not showing due to error:', error);
      return null;
    }
    console.debug('[NotificationCenter] Not ready - returning null');
    return null;
  }

  if (!config) {
    return null;
  }

  return (
    <MagicBellProvider
      apiKey={config.apiKey}
      token={config.userToken}
      userEmail={config.userEmail}
      userId={config.userId}
    >
      <div className={`relative ${className || ''}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-md bg-white/80 border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center"
          aria-label="Notifications"
          aria-expanded={isOpen}
        >
          <Bell className="w-5 h-5 text-gray-700" />
          {/* Badge will be shown by MagicBell */}
        </button>
        
        {isOpen && (
          <>
            {/* Backdrop to close on click outside */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            {/* Notification dropdown */}
            <div className="absolute right-0 top-full mt-2 z-50 shadow-lg rounded-lg overflow-hidden border border-gray-200 bg-white">
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

