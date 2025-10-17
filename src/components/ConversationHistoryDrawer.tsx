import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { logger } from '../lib/logger';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onDeleteConversation: (id: string) => void;
  deletingId: string | null;
}

export function ConversationHistoryDrawer({ 
  isOpen, 
  onClose, 
  conversations, 
  onDeleteConversation,
  deletingId 
}: ConversationHistoryDrawerProps) {
  // Lock background scroll while drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[99998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* centered modal */}
          <motion.div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="w-full max-w-2xl max-h-[85vh] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 flex flex-col shadow-2xl overflow-hidden"
              initial={{ 
                opacity: 0,
                scale: 0.9,
                y: 30
              }}
              animate={{ 
                opacity: 1,
                scale: 1,
                y: 0
              }}
              exit={{ 
                opacity: 0,
                scale: 0.9,
                y: 30
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 rounded-lg border border-blue-500/30 shadow-lg">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-white">Conversation History</h2>
                  <p className="text-xs text-gray-400 hidden sm:block">Manage your conversations</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-gray-700/50 rounded-lg transition-all duration-200 text-gray-400 hover:text-white"
                aria-label="Close conversation history"
              >
                <X size={20} />
              </button>
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
              {conversations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">No conversations yet</p>
                  <p className="text-gray-500 text-xs mt-1">Start chatting to see your history!</p>
                </div>
              ) : (
                conversations.map((conv, index) => (
                  <div
                    key={conv.id}
                    className={`
                      group relative bg-gradient-to-br from-gray-800/80 to-gray-800/60 backdrop-blur-sm p-3.5 md:p-4 rounded-xl hover:from-gray-700/80 hover:to-gray-700/60 active:scale-[0.98] transition-all duration-300 cursor-pointer border border-gray-700/50 hover:border-gray-600/50 shadow-md hover:shadow-lg
                      ${deletingId === conv.id ? 'opacity-50 pointer-events-none' : 'opacity-100'}
                    `}
                    onClick={() => {
                      onClose();
                      window.location.href = `/chat?conversation=${conv.id}`;
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Conversation Icon */}
                      <div className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                        <svg className="w-4 h-4 md:w-5 md:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base text-white font-semibold leading-tight truncate mb-1">
                          {conv.title || `Conversation ${index + 1}`}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="truncate">{(() => {
                            // ✅ BULLETPROOF DATE HANDLING - Handle both Dexie and Supabase formats
                            const dateField = conv.updated_at || conv.created_at;
                            if (!dateField) return 'Invalid Date';
                            
                            try {
                              const date = new Date(dateField);
                              if (isNaN(date.getTime())) return 'Invalid Date';
                              
                              return date.toLocaleString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                hour: 'numeric', 
                                minute: '2-digit' 
                              });
                            } catch (error) {
                              logger.error('[ConversationHistoryDrawer] Date parsing error:', error, dateField);
                              return 'Invalid Date';
                            }
                          })()}</span>
                        </div>
                      </div>
                      
                      {/* Delete Button - Right side */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        disabled={deletingId === conv.id}
                        className="flex-shrink-0 p-2.5 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg transition-all duration-200 border border-red-500/20 hover:border-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed group/delete"
                        title="Delete conversation"
                        aria-label="Delete conversation"
                      >
                        {deletingId === conv.id ? (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 group-hover/delete:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer (User Tip with Sync Button) */}
            <div className="flex-shrink-0 border-t border-gray-700/50 px-5 py-4 md:px-6 bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-b-2xl">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-center flex-1">
                  <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-sm text-gray-300">
                    <span className="font-medium">Tip:</span> Click any conversation to continue chatting, or tap the
                    <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-gray-700/50 rounded text-xs">
                      <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </span>
                    button to delete
                  </div>
                </div>
                
                {/* Manual Delta Sync Button - SAFE to use with delta sync */}
                <button
                  onClick={async () => {
                    try {
                      const { conversationSyncService } = await import('../services/conversationSyncService');
                      const supabase = (await import('../lib/supabaseClient')).default;
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        logger.debug('[ConversationHistoryDrawer] 🚀 Starting manual delta sync...');
                        await conversationSyncService.deltaSync(user.id);
                        logger.debug('[ConversationHistoryDrawer] ✅ Delta sync completed');
                        // Refresh the conversations list
                        window.location.reload();
                      }
                    } catch (error) {
                      logger.error('[ConversationHistoryDrawer] ❌ Delta sync failed:', error);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-all duration-200 border border-green-500/30 hover:border-green-500/50"
                  title="Delta sync - only fetches changed data"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 9 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="text-xs font-medium">Delta Sync</span>
                </button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
