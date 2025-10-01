import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useMessageStore } from '../../stores/useMessageStore';

export default function QuickActions() {
  const { clearMessages } = useMessageStore();
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);

  const handleNewChat = async () => {
    // ✅ Clear current conversation state
    clearMessages();
    
    // ✅ Navigate to clean URL (removes conversation ID param)
    // Backend will auto-create new conversation with title from first message
    window.history.pushState({}, '', '/chat');
    
    // ✅ Reload to reset state cleanly (future: could use React Router)
    window.location.reload();
  };

  const handleViewHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('conversations')
        .select('id, title, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      setConversations(data || []);
      setShowHistory(true);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const actions = [
    { icon: '➕', label: 'Start New Chat', action: handleNewChat },
    { icon: '📜', label: 'View History', action: handleViewHistory },
    { icon: '📊', label: 'Emotional Insights', action: () => console.log('Coming soon') },
    { icon: '⚙️', label: 'Settings', action: () => console.log('Coming soon') },
  ];

  return (
    <>
      <div className="bg-[#2c2f36] p-4 rounded-lg shadow">
        <h3 className="text-gray-300 text-sm font-medium mb-3">Quick Actions</h3>
        <ul className="space-y-2">
          {actions.map((action, index) => (
            <li key={index}>
              <button
                onClick={action.action}
                className="w-full text-left text-gray-200 hover:text-white hover:bg-gray-700/50 p-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
              >
                <span className="text-lg">{action.icon}</span>
                <span className="text-sm">{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Professional History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Conversation History</h3>
              <button 
                onClick={() => setShowHistory(false)} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {conversations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 dark:text-gray-500 text-sm">No conversations yet</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Start chatting to see your history!</p>
                </div>
              ) : (
                conversations.map((conv, index) => (
                  <div 
                    key={conv.id} 
                    className="group p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-750 rounded-xl hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all duration-200 border border-gray-100 dark:border-gray-600"
                    onClick={() => {
                      setShowHistory(false);
                      window.location.href = `/chat?conversation=${conv.id}`;
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                          {conv.title || `Conversation ${index + 1}`}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                          <span>📅</span>
                          <span>{new Date(conv.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <div className="text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors">
                        →
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <button 
              onClick={() => setShowHistory(false)} 
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
