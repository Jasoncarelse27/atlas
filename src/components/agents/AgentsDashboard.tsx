// Atlas Agents Dashboard Component
// Main dashboard layout with agents, notifications, and business notes

import React from 'react';
import AgentsList from './AgentsList';
import BusinessNotesPanel from './BusinessNotesPanel';
import NotificationsPanel from './NotificationsPanel';
import type { Notification, BusinessNote } from '../../services/agentsService';

interface AgentsDashboardProps {
  notifications: Notification[];
  notes: BusinessNote[];
  isLoading: boolean;
  userId: string | null;
}

const AgentsDashboard: React.FC<AgentsDashboardProps> = ({
  notifications,
  notes,
  isLoading,
  userId
}) => {
  // Get user email for greeting
  const [userEmail, setUserEmail] = React.useState<string>('');

  React.useEffect(() => {
    const getUserEmail = async () => {
      try {
        const { data: { user } } = await (await import('../../lib/supabaseClient')).supabase.auth.getUser();
        setUserEmail(user?.email || '');
      } catch (error) {
        // Ignore errors
      }
    };
    getUserEmail();
  }, []);

  // Generate greeting based on email
  const getGreeting = () => {
    const email = userEmail.toLowerCase();
    if (email.includes('jason')) {
      return 'Good morning, Jason.';
    }
    if (email.includes('rima')) {
      return 'Welcome, Rima.';
    }
    return 'Hi there —';
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
          {getGreeting()}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          A quiet space where the tools that support your business stay organized, visible, and easy to manage.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agents List */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 tracking-tight">
              Agents
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              A quick view of the tools that support your day-to-day work.
            </p>
            <AgentsList />
          </div>

          {/* Business Notes */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 tracking-tight">
              Business Notes
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              A simple place to jot down thoughts, decisions, ideas, or things you want Atlas to remember for later.
            </p>
            <BusinessNotesPanel
              notes={notes}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 tracking-tight">
              Notifications
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Updates filtered just for you.
            </p>
            <NotificationsPanel
              notifications={notifications}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentsDashboard;

