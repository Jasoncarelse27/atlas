import { Bookmark, Bot, Check, Clock, Copy, Edit3, MessageSquare, Share2, Trash2, User, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import AudioPlayer from '../../../components/AudioPlayer';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Tooltip from '../../../components/Tooltip';
import type { Message } from '../../../types/chat';

interface ConversationViewProps {
  conversation: { 
    id: string;
    title: string;
    messages: Message[];
    lastUpdated: string;
    createdAt: string;
    pinned?: boolean;
  };
  isLoading?: boolean;
  onDeleteMessage?: (id: string) => void;
  onCopyMessage?: (content: string) => void;
  className?: string;
  onUpdateTitle?: (title: string) => void;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
}

const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  isLoading = false,
  onDeleteMessage,
  onCopyMessage,
  className = '',
  onUpdateTitle,
  messagesEndRef
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(conversation.title);
  const endRef = useRef<HTMLDivElement>(null); 
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change or loading state changes
  useEffect(() => {
    if (messagesEndRef?.current || endRef.current) {
      const ref = messagesEndRef?.current || endRef.current;
      ref?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation.messages, isLoading, messagesEndRef]);

  // Focus title input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleCopy = (id: string, content: string) => {
    if (onCopyMessage) {
      onCopyMessage(content);
    } else {
      navigator.clipboard.writeText(content);
    }
    
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEditTitle = () => {
    setEditedTitle(conversation.title);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (editedTitle.trim() && onUpdateTitle) {
      onUpdateTitle(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Conversation Title - Dark Theme */}
      <div className="flex items-center justify-between mb-4">
        {isEditingTitle ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter conversation title"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveTitle();
                } else if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                }
              }}
            />
            <button
              onClick={handleSaveTitle}
              className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsEditingTitle(false)}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              {conversation.title}
            </h2>
            <Tooltip content="Edit title">
              <button
                onClick={handleStartEditTitle}
                className="p-1.5 text-gray-400 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </Tooltip>
          </>
        )}
      </div>

      {conversation.messages.filter(m => m.role !== 'system').map((message) => (
        <div 
          key={message.id}
          className={`rounded-xl p-4 ${
            message.role === 'user'
              ? 'bg-blue-900/40 border border-blue-800/80 shadow-md' 
              : 'bg-gray-800/90 border border-gray-700 shadow-md'
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className={`p-2 rounded-full flex-shrink-0 ${
              message.role === 'user' 
                ? 'bg-blue-800/80' 
                : 'bg-purple-800/80'
            }`}>
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-blue-200" />
              ) : (
                <Bot className="w-4 h-4 text-purple-200" />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">
                    {message.role === 'user' ? 'You' : 'Atlas'}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Tooltip content={copiedId === message.id ? "Copied!" : "Copy"}>
                    <button
                      onClick={() => handleCopy(message.id, message.content)}
                      className="p-1 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-700"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </Tooltip>
                  
                  {onDeleteMessage && (
                    <Tooltip content="Delete">
                      <button
                        onClick={() => onDeleteMessage(message.id)}
                        className="p-1 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}
                  
                  <Tooltip content="More options">
                    <button className="neumorphic-button p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                      className="p-1 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-700"
                    </button>
                  </Tooltip>
                </div>
              </div>
              
              {/* Message Content */}
              <div className="text-gray-200 whitespace-pre-wrap">
                {message.content}
              </div>
              
              {/* Audio Player */}
              {message.audioUrl && (
                <div className="mt-3">
                  <AudioPlayer
                    audioUrl={message.audioUrl}
                    title="Audio Response"
                    variant="minimal"
                  />
                </div>
              )}
              
              {/* Image Preview */}
              {message.imageUrl && (
                <div className="mt-3">
                  <img 
                    src={message.imageUrl} 
                    alt="Uploaded content" 
                    className="max-h-60 rounded-lg border border-gray-200"
                  />
                </div>
              )}
              
              {/* Action Buttons */}
              {message.role === 'assistant' && (
                <div className="mt-4 flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 rounded-lg text-xs flex items-center gap-1 transition-colors border border-gray-600/80">
                    <Share2 className="w-3 h-3" />
                    <span>Share</span>
                  </button>
                  
                  <button className="px-3 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 rounded-lg text-xs flex items-center gap-1 transition-colors border border-gray-600/80">
                    <Bookmark className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      
      {/* Loading Message */}
      {isLoading && (
        <div className="rounded-xl p-4 bg-gray-800/90 border border-gray-700 shadow-md">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-800/80 rounded-full flex-shrink-0">
              <Bot className="w-4 h-4 text-purple-200" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center mb-2">
                <span className="font-medium text-white mr-2">Atlas</span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Now
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-300">
                <LoadingSpinner size="sm" />
                <span>Generating response...</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Scroll anchor */}
      <div ref={endRef} />
    </div>
  );
};

export default ConversationView;