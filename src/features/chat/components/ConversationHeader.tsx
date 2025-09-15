import { MessageSquare, Plus, Search, X } from 'lucide-react';
import React from 'react';
import Tooltip from '../components/Tooltip';

interface ConversationHeaderProps {
  onClose: () => void;
  onCreateNewConversation: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  conversationsCount: number;
}

const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  onClose,
  onCreateNewConversation,
  searchQuery,
  onSearchChange,
  onClearSearch,
  conversationsCount
}) => {
  return (
    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 neumorphic-button bg-white rounded-lg">
            <MessageSquare className="w-5 h-5 text-gray-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Conversations</h2>
            <p className="text-xs text-gray-600">{conversationsCount} conversations</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="neumorphic-button p-2 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
          aria-label="Close conversation history"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Search and New Chat */}
      <div className="mt-4 flex gap-2">
        <div className="neumorphic-input-wrapper flex-1 flex items-center rounded-lg overflow-hidden">
          <Search className="w-4 h-4 text-gray-400 ml-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations"
            className="w-full p-2 border-0 bg-transparent text-gray-900 focus:outline-none text-sm"
          />
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="p-1 mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <Tooltip content="New conversation">
          <button
            onClick={onCreateNewConversation}
            className="neumorphic-button-strong p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            aria-label="New conversation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default ConversationHeader;
