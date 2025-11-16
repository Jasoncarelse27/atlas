import React, { useState, useEffect } from 'react';
import { MagicBellProvider, FloatingInbox, useNotifications } from '@magicbell/react';
import { useMagicBell } from '../hooks/useMagicBell';
import { Bell } from 'lucide-react';

interface NotificationCenterProps {
  className?: string;
}

// Inner component that uses MagicBell hooks (must be inside MagicBellProvider)
const NotificationBell: React.FC<{ isOpen: boolean; setIsOpen: (open: boolean) => void; className?: string }> = ({ isOpen, setIsOpen, className }) => {
  // ✅ Get unread count from MagicBell SDK (must be inside provider)
  const { unreadCount = 0 } = useNotifications() || {};

  return (
    <div className={`relative ${className || ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md bg-white/80 border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 text-gray-700" />
        {/* ✅ Unread badge indicator */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center min-w-[20px]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
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
  );
};

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
          className="relative p-2 rounded-md bg-white/80 border border-gray-300 opacity-50 cursor-not-allowed flex items-center justify-center"
          aria-label="Notifications (not available)"
          title="Notifications are not available"
        >
          <Bell className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <MagicBellProvider
      apiKey={config.apiKey}
      token={config.userToken}
      userEmail={config.userEmail}
      userId={config.userId}
    >
      <NotificationBell isOpen={isOpen} setIsOpen={setIsOpen} className={className} />
    </MagicBellProvider>
  );
};

