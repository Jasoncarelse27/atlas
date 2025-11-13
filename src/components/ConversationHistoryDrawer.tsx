import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from 'react-hot-toast';
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
  onRefresh?: () => Promise<void>;
  userId?: string; // ✅ For live insight widgets (optional, falls back to getUser())
}

export function ConversationHistoryDrawer({ 
  isOpen, 
  onClose, 
  conversations, 
  onDeleteConversation,
  deletingId,
  onRefresh,
  userId
}: ConversationHistoryDrawerProps) {
  // ✅ FIX #1: Add loading states for better mobile UX
  const [isNavigating, setIsNavigating] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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
            className="fixed inset-0 bg-atlas-stone/50 backdrop-blur-md z-[99998]"
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
              className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] bg-[#F9F6F3] rounded-2xl border border-[#E8DDD2] flex flex-col shadow-2xl overflow-hidden"
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
            {/* header - ✅ RESPONSIVE: Better mobile spacing */}
            <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5 border-b border-[#E8DDD2] bg-white rounded-t-2xl">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 bg-[#8FA67E]/20 rounded-lg border border-[#8FA67E]/30">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#8FA67E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-[#3B3632]">Conversation History</h2>
                  <p className="text-xs text-[#8B7E74] hidden sm:block">Manage your conversations</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-[#F0E6DC] rounded-lg transition-all duration-200 text-[#8B7E74] hover:text-[#5A524A] min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close conversation history"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* list - ✅ RESPONSIVE: Better mobile spacing */}
            <div className="flex-1 overflow-y-auto px-0 py-3 sm:py-4 min-h-0">
              <div className="px-3 sm:px-4 space-y-2 sm:space-y-3">
              {conversations.length === 0 ? (
                // ✅ BEST PRACTICE: Enhanced empty state with clear CTA and helpful guidance
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-[#8FA67E]/20 rounded-full flex items-center justify-center border-2 border-[#8FA67E]/30">
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-[#8FA67E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-[#3B3632] mb-2">Start Your First Conversation</h3>
                  <p className="text-sm text-[#8B7E74] mb-6 max-w-sm mx-auto">
                    Ask Atlas anything - it's your emotionally intelligent AI assistant ready to help you grow.
                  </p>
                  <button
                    onClick={onClose}
                    className="px-6 py-3 bg-[#8FA67E] hover:bg-[#7E9570] text-white font-medium rounded-xl transition-colors duration-200 shadow-md hover:shadow-lg"
                    aria-label="Close and start new conversation"
                  >
                    Get Started
                  </button>
                </div>
              ) : (
                conversations.map((conv, index) => (
                  <div
                    key={conv.id}
                    className={`
                      group relative bg-white border border-[#E8DDD2] p-3 sm:p-3.5 md:p-4 rounded-xl hover:border-[#C6D4B0] hover:shadow-md active:scale-[0.98] transition-all duration-300 cursor-pointer min-h-[60px] sm:min-h-[72px]
                      ${deletingId === conv.id || isNavigating === conv.id ? 'opacity-50 pointer-events-none' : 'opacity-100'}
                    `}
                    onClick={() => {
                      // ✅ Close drawer IMMEDIATELY for instant feedback
                      onClose();
                      
                      // ✅ Then navigate in background
                      setIsNavigating(conv.id);
                      const url = `/chat?conversation=${conv.id}`;
                      window.history.pushState({ conversationId: conv.id }, '', url);
                      
                      // Trigger custom event for ChatPage to handle
                      window.dispatchEvent(new PopStateEvent('popstate', { state: { conversationId: conv.id } }));
                      
                      // Reset loading state after navigation
                      setTimeout(() => setIsNavigating(null), 500);
                    }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* Conversation Icon or Loading Spinner - ✅ RESPONSIVE: Smaller on mobile */}
                      <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-[#C6D4B0]/30 rounded-lg flex items-center justify-center border border-[#C6D4B0]/50">
                        {isNavigating === conv.id ? (
                          <svg className="animate-spin w-4 h-4 md:w-5 md:h-5 text-[#8FA67E]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-[#8FA67E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        )}
                      </div>
                      
                      {/* Content - ✅ RESPONSIVE: Better text scaling */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm md:text-base text-[#3B3632] font-semibold leading-tight truncate mb-0.5 sm:mb-1">
                          {conv.title || `Conversation ${index + 1}`}
                        </p>
                        <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-[#8B7E74]">
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
                      
                      {/* Delete Button - ✅ RESPONSIVE: Proper touch target on mobile */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        disabled={deletingId === conv.id || isNavigating === conv.id}
                        className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 sm:p-3 bg-[#CF9A96]/10 hover:bg-[#CF9A96]/20 active:bg-[#CF9A96]/30 text-[#A67571] hover:text-[#8B5F5B] rounded-lg transition-all duration-200 border border-[#CF9A96]/20 hover:border-[#CF9A96]/40 disabled:opacity-50 disabled:cursor-not-allowed group/delete flex items-center justify-center"
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
            </div>
            
            {/* Footer - ✅ RESPONSIVE: Better mobile layout */}
            <div className="flex-shrink-0 border-t border-[#E8DDD2] px-4 py-3 sm:px-5 sm:py-4 md:px-6 bg-white rounded-b-2xl">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 text-center flex-1">
                  <div className="p-2 bg-[#B8A5D6]/10 rounded-lg border border-[#B8A5D6]/20">
                    <svg className="w-4 h-4 text-[#8B7AB8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-xs sm:text-sm text-[#5A524A]">
                    <span className="font-medium">Tip:</span> <span className="hidden sm:inline">Click any conversation to continue chatting, or tap the</span>
                    <span className="sm:hidden">Tap to open, or</span>
                    <span className="inline-flex items-center mx-1 px-1 sm:px-1.5 py-0.5 bg-[#F0E6DC] rounded text-[10px] sm:text-xs">
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#A67571]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </span>
                    <span className="hidden sm:inline">button to delete</span>
                    <span className="sm:hidden">to delete</span>
                  </div>
                </div>
                
                {/* Manual Delta Sync Button - ✅ RESPONSIVE: Better mobile sizing */}
                <button
                  onClick={async () => {
                    // ✅ FIX #2: Update state instead of full page reload
                    setIsSyncing(true);
                    try {
                      const { conversationSyncService } = await import('../services/conversationSyncService');
                      const { atlasDB } = await import('../database/atlasDB');
                      const supabase = (await import('../lib/supabaseClient')).default;
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        logger.debug('[ConversationHistoryDrawer] 🚀 Starting manual delta sync...');
                        
                        // ✅ CRITICAL FIX: Clear syncMetadata to force first sync (if IndexedDB is empty)
                        const localCount = await atlasDB.conversations
                          .where('userId')
                          .equals(user.id)
                          .count();
                        
                        if (localCount === 0) {
                          logger.debug('[ConversationHistoryDrawer] 🔄 IndexedDB empty - clearing syncMetadata to force first sync');
                          await atlasDB.syncMetadata.delete(user.id);
                        }
                        
                        await conversationSyncService.deltaSync(user.id);
                        logger.debug('[ConversationHistoryDrawer] ✅ Delta sync completed');
                        
                        // ✅ Refresh the conversations list via callback (no page reload)
                        if (onRefresh) {
                          await onRefresh();
                          logger.debug('[ConversationHistoryDrawer] ✅ Conversation list refreshed');
                        }
                      }
                    } catch (error) {
                      logger.error('[ConversationHistoryDrawer] ❌ Delta sync failed:', error);
                      // ✅ Show error to user (better than silent failure)
                      toast.error('Sync failed. Please check your connection and try again.');
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 bg-[#8FA67E]/20 hover:bg-[#8FA67E]/30 text-[#8FA67E] rounded-lg transition-all duration-200 border border-[#8FA67E]/30 hover:border-[#8FA67E]/50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                  title="Delta sync - only fetches changed data"
                >
                  {isSyncing ? (
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 9 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span className="text-xs font-medium">{isSyncing ? 'Syncing...' : 'Delta Sync'}</span>
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
