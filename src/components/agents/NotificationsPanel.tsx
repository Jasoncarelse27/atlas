// Atlas Notifications Panel Component
// Displays user notifications with mark-as-read functionality

import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, Mail } from 'lucide-react';
import React from 'react';
import { useFetchEmails, useMarkNotificationRead } from '../../hooks/useAgentsDashboard';
import type { Notification } from '../../services/agentsService';

interface NotificationsPanelProps {
  notifications: Notification[];
  isLoading: boolean;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  notifications,
  isLoading
}) => {
  const markReadMutation = useMarkNotificationRead();
  const fetchEmailsMutation = useFetchEmails();

  const handleMarkRead = async (notificationId: string) => {
    try {
      await markReadMutation.mutateAsync(notificationId);
    } catch (error) {
      // Error handled by mutation hook (toast)
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Get notification type color
  const getTypeColor = (type: string) => {
    if (type.includes('support')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
    if (type.includes('billing')) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
    if (type.includes('bug_report')) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
    if (type.includes('partnership')) return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-[#B2BDA3] dark:text-[#B2BDA3]" />
            <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              Notifications
            </span>
          </div>
          {unreadCount > 0 && (
            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#B2BDA3] text-white text-xs font-semibold rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {/* Fetch Emails Button */}
        <button
          onClick={() => fetchEmailsMutation.mutate({ mailbox: 'jason' })}
          disabled={fetchEmailsMutation.isLoading}
          className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-[#B2BDA3] hover:bg-[#8FA67E] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-medium rounded-lg transition-colors"
        >
          {fetchEmailsMutation.isLoading ? (
            <>
              <span className="animate-spin text-xs sm:text-sm">⚙️</span>
              <span>Fetching...</span>
            </>
          ) : (
            <>
              <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Fetch Emails</span>
            </>
          )}
        </button>
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto max-h-[400px] sm:max-h-[500px] lg:max-h-[600px]">
        {notifications.length === 0 ? (
          <div className="p-4 sm:p-6 text-center">
            <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  !notification.is_read ? 'bg-[#F4E5D9]/30 dark:bg-[#F4E5D9]/10' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                      <span className={`px-1.5 sm:px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(notification.type)}`}>
                        {notification.type.replace('email_agent.', '')}
                      </span>
                      {!notification.is_read && (
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#B2BDA3] rounded-full flex-shrink-0"></span>
                      )}
                    </div>
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-1 break-words">
                      {notification.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2 break-words">
                      {notification.body}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <button
                      onClick={() => handleMarkRead(notification.id)}
                      disabled={markReadMutation.isLoading}
                      className="flex-shrink-0 p-1.5 sm:p-2 text-gray-400 hover:text-[#B2BDA3] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      aria-label="Mark as read"
                    >
                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;

