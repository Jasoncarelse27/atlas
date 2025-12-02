// Atlas Agents Dashboard Page
// Agents Dashboard - Main page component
// Displays agents, notifications, and business notes

import { ArrowLeft } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import AgentsDashboard from '../components/agents/AgentsDashboard';
import { useNotifications } from '../hooks/useAgentsDashboard';
import { useBusinessNotes } from '../hooks/useAgentsDashboard';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { navigateToLastConversation } from '../utils/chatNavigation';

const AgentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch data using React Query hooks
  const {
    data: notifications = [],
    isLoading: isNotificationsLoading,
    error: notificationsError,
    refetch: refetchNotifications
  } = useNotifications();

  const {
    data: notes = [],
    isLoading: isNotesLoading,
    error: notesError,
    refetch: refetchNotes
  } = useBusinessNotes();

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id || null);
      } catch (error) {
        logger.error('[AgentsPage] Failed to get user:', error);
      }
    };
    getUser();
  }, []);

  // Handle errors
  if (notificationsError || notesError) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#F4E5D9] dark:bg-gray-900 flex">
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Error Loading Dashboard
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {notificationsError?.message || notesError?.message || 'Failed to load dashboard data'}
                </p>
                <button
                  onClick={() => {
                    refetchNotifications();
                    refetchNotes();
                  }}
                  className="px-4 py-2 bg-[#B2BDA3] dark:bg-gray-700 text-white rounded-md hover:bg-[#8FA67E] dark:hover:bg-gray-600"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F4E5D9] dark:bg-gray-900 flex">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 bg-white/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 z-10">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateToLastConversation(navigate)}
                className="flex items-center justify-center p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Back to Chat"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agents Dashboard</h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 pt-20">
          <AgentsDashboard
            notifications={notifications}
            notes={notes}
            isLoading={isNotificationsLoading || isNotesLoading}
            userId={userId}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AgentsPage;

