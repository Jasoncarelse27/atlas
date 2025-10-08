import { useEffect, useState } from 'react';
import db from '../../lib/db';

export default function MessageStoreDebugger() {
  const [messageCount, setMessageCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const refreshStats = async () => {
    setIsLoading(true);
    try {
      const messages = await db.messages.count();
      const conversations = await db.conversations.count();
      setMessageCount(messages);
      setConversationCount(conversations);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const exportJSON = async () => {
    try {
      const messages = await db.messages.toArray();
      const conversations = await db.conversations.toArray();
      
      const data = {
        messages,
        conversations,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atlas-dexie-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('✅ Dexie data exported successfully');
    } catch (error) {
    }
  };

  const clearDB = async () => {
    if (window.confirm('⚠️ This will permanently delete all messages and conversations. Are you sure?')) {
      try {
        await db.messages.clear();
        await db.conversations.clear();
        await refreshStats();
        console.log('✅ Database cleared successfully');
      } catch (error) {
      }
    }
  };

  // Load stats on mount
  useEffect(() => {
    refreshStats();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-lg z-50 max-w-sm">
      <div className="text-xs text-gray-300 mb-3 font-mono">
        🛠️ <strong>Dexie Debugger</strong>
      </div>
      
      <div className="space-y-2 text-xs text-gray-400 mb-3">
        <div>Messages: <span className="text-blue-400">{messageCount}</span></div>
        <div>Conversations: <span className="text-green-400">{conversationCount}</span></div>
      </div>

      <div className="flex flex-col space-y-2">
        <button
          onClick={exportJSON}
          disabled={isLoading}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
        >
          📥 Export JSON
        </button>
        
        <button
          onClick={clearDB}
          disabled={isLoading}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
        >
          🗑️ Clear DB
        </button>
        
        <button
          onClick={refreshStats}
          disabled={isLoading}
          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 text-white text-xs rounded transition-colors"
        >
          {isLoading ? '⏳ Loading...' : '🔄 Refresh Stats'}
        </button>
      </div>
    </div>
  );
}
