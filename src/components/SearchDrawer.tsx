import { AnimatePresence, motion } from "framer-motion";
import { Search, X, MessageSquare, Clock, ChevronRight } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { searchMessages, highlightSearchTerm, type SearchResult } from "../services/searchService";
import { logger } from '../lib/logger';

interface SearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentConversationId?: string;
  onNavigateToMessage: (conversationId: string, messageId: string) => void;
}

export function SearchDrawer({ 
  isOpen, 
  onClose, 
  userId,
  currentConversationId,
  onNavigateToMessage
}: SearchDrawerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchScope, setSearchScope] = useState<'all' | 'current'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Lock background scroll while drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 100);
      // ✅ MEMORY LEAK FIX: Cleanup timer on unmount or when drawer closes
      return () => clearTimeout(focusTimer);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const conversationFilter = searchScope === 'current' ? currentConversationId : undefined;
        const searchResults = await searchMessages(userId, query, conversationFilter);
        setResults(searchResults);
      } catch (error) {
        logger.error('[SearchDrawer] Search failed:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, userId, searchScope, currentConversationId, isOpen]);

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    logger.debug('[SearchDrawer] Navigating to message:', result.messageId);
    onNavigateToMessage(result.conversationId, result.messageId);
    onClose();
  };

  // Handle close with cleanup
  const handleClose = () => {
    setQuery('');
    setResults([]);
    onClose();
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-atlas-stone/50 backdrop-blur-md z-[99998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Centered Modal */}
          <motion.div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          >
            <motion.div
              className="w-full max-w-2xl max-h-[85vh] bg-[#F9F6F3] rounded-2xl border border-[#E8DDD2] flex flex-col shadow-2xl overflow-hidden"
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
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 border-b border-[#E8DDD2] bg-white rounded-t-2xl">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2.5 bg-[#8FA67E]/20 rounded-lg border border-[#8FA67E]/30">
                    <Search className="w-5 h-5 text-[#8FA67E]" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg md:text-xl font-bold text-[#3B3632]">Search Messages</h2>
                    <p className="text-xs text-[#8B7E74] hidden sm:block">
                      Search across {searchScope === 'all' ? 'all conversations' : 'current conversation'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleClose} 
                  className="p-2 hover:bg-[#F0E6DC] rounded-lg transition-all duration-200 text-[#8B7E74] hover:text-[#5A524A]"
                  aria-label="Close search"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Input */}
              <div className="px-4 py-4 md:px-6 border-b border-[#E8DDD2]/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B7E74]" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search messages..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#E8DDD2] rounded-lg text-[#3B3632] placeholder-[#B8A9A0] focus:outline-none focus:ring-2 focus:ring-[#8FA67E]/50 focus:border-[#8FA67E]/50 transition-all"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-[#E8DDD2] border-t-[#8FA67E] rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Scope Toggle */}
                {currentConversationId && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setSearchScope('all')}
                      className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-all ${
                        searchScope === 'all'
                          ? 'bg-[#8FA67E]/20 text-[#8FA67E] border border-[#8FA67E]/30'
                          : 'bg-[#F0E6DC] text-[#8B7E74] border border-[#E8DDD2] hover:bg-[#E8DDD2]'
                      }`}
                    >
                      All Conversations
                    </button>
                    <button
                      onClick={() => setSearchScope('current')}
                      className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-all ${
                        searchScope === 'current'
                          ? 'bg-[#8FA67E]/20 text-[#8FA67E] border border-[#8FA67E]/30'
                          : 'bg-[#F0E6DC] text-[#8B7E74] border border-[#E8DDD2] hover:bg-[#E8DDD2]'
                      }`}
                    >
                      This Conversation
                    </button>
                  </div>
                )}
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 min-h-0">
                {query.trim().length < 2 ? (
                  <div className="flex flex-col items-center justify-center h-full text-[#8B7E74] py-12">
                    <Search className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">Type at least 2 characters to search</p>
                    <p className="text-xs mt-1 opacity-70">Press Esc to close</p>
                  </div>
                ) : results.length === 0 && !isSearching ? (
                  <div className="flex flex-col items-center justify-center h-full text-[#8B7E74] py-12">
                    <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">No messages found</p>
                    <p className="text-xs mt-1 opacity-70">Try a different search term</p>
                  </div>
                ) : (
                  results.map((result) => (
                    <motion.button
                      key={result.messageId}
                      onClick={() => handleResultClick(result)}
                      className="w-full p-4 bg-white hover:bg-[#F0E6DC] border border-[#E8DDD2] hover:border-[#C6D4B0] rounded-xl text-left transition-all group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      {/* Header: Conversation + Time */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs text-[#8FA67E] font-medium">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[200px]">{result.conversationTitle}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[#8B7E74]">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimestamp(result.timestamp)}</span>
                        </div>
                      </div>

                      {/* Message Snippet */}
                      <div 
                        className="text-sm text-[#5A524A] line-clamp-2 mb-2"
                        dangerouslySetInnerHTML={{ 
                          __html: highlightSearchTerm(result.snippet, query) 
                        }}
                      />

                      {/* Footer: Role Badge + Arrow */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          result.role === 'user' 
                            ? 'bg-[#C6D4B0]/30 text-[#8FA67E]'
                            : 'bg-[#B8A5D6]/30 text-[#8B7AB8]'
                        }`}>
                          {result.role === 'user' ? 'You' : 'Atlas'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#B8A9A0] group-hover:text-[#8FA67E] transition-colors" />
                      </div>
                    </motion.button>
                  ))
                )}
              </div>

              {/* Footer */}
              {results.length > 0 && (
                <div className="px-5 py-3 border-t border-[#E8DDD2] bg-white text-center">
                  <p className="text-xs text-[#8B7E74]">
                    {results.length} {results.length === 1 ? 'result' : 'results'} found
                    {results.length === 50 && ' (showing first 50)'}
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

