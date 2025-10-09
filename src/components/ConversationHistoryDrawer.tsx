import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* sliding drawer */}
          <motion.div
            className="fixed right-0 top-0 z-[60] w-full sm:w-[420px] bg-gray-900 border-l border-gray-700 flex flex-col"
            style={{
              height: "100vh",
              maxHeight: "100vh",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900">
              <h2 className="text-lg font-semibold text-white">Conversation History</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2">
                <X size={20} />
              </button>
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
              {conversations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">No conversations yet</p>
                  <p className="text-gray-500 text-xs mt-1">Start chatting to see your history!</p>
                </div>
              ) : (
                conversations.map((conv, index) => (
                  <div
                    key={conv.id}
                    className="bg-gray-800 p-3 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => {
                      onClose();
                      window.location.href = `/chat?conversation=${conv.id}`;
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium leading-tight break-words">
                          {conv.title || `Conversation ${index + 1}`}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                          <span>📅</span>
                          <span>{new Date(conv.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        </p>
                      </div>
                      
                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        disabled={deletingId === conv.id}
                        className="flex-shrink-0 p-1 text-red-400 hover:text-red-500 disabled:opacity-50 text-sm"
                        title="Delete conversation"
                      >
                        {deletingId === conv.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          '🗑'
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer with close button - Always visible */}
            <div className="flex-shrink-0 border-t border-gray-700 px-6 py-4 bg-red-500">
              <button
                onClick={onClose}
                className="w-full py-4 rounded-lg font-bold bg-yellow-500 hover:bg-yellow-600 transition-colors text-black text-lg"
              >
                🔴 CLOSE BUTTON 🔴
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
