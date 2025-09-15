import { Brain, LogOut, MessageSquare, Settings, User } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import ConversationView from '../features/chat/components/ConversationView';
import { useMessageLimit, useTierAccess } from '../hooks/useTierAccess';
import ErrorBoundary from '../lib/errorBoundary';
import { supabase } from '../lib/supabase';
import { sendMessageToSupabase } from '../services/chatService';
import type { Message } from '../types/chat';

interface ChatPageProps {
  user?: any;
}

const ChatPage: React.FC<ChatPageProps> = ({ user }) => {
  const navigate = useNavigate();
  
  // 🎯 TIER ENFORCEMENT: Add tier access hooks
  const { tier, model, claudeModelName } = useTierAccess();
  const { checkAndAttemptMessage } = useMessageLimit();
  const [messageCount, setMessageCount] = React.useState(0);
  
  const [conversation, setConversation] = React.useState({
    id: 'default',
    title: 'Atlas AI Chat',
    messages: [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! I\'m Atlas, your AI-powered emotional intelligence companion. How can I help you today?',
        timestamp: new Date().toISOString()
      }
    ],
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (_error) {
      // Handle logout error silently in production
    }
  };

  const handleSendMessage = async (message: string) => {
    if (isProcessing || !message.trim()) return;
    
    // 🎯 TIER ENFORCEMENT: Check message limit
    const canSend = await checkAndAttemptMessage(messageCount);
    if (!canSend) {
      return; // Toast already shown by hook
    }
    
    setIsProcessing(true);
    
    try {
      // Add user message to conversation
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        lastUpdated: new Date().toISOString()
      }));

      // Get session for authentication
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      if (!accessToken) {
        throw new Error("No access token available");
      }

      // Send message using the chat service
      await sendMessageToSupabase({
        message: message,
        conversationId: conversation.id,
        accessToken: accessToken,
        onMessage: (partial: string) => {
          // Handle streaming message updates
          console.log("Partial message:", partial);
        },
        onComplete: (full: string) => {
          // Add assistant response to conversation
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: full,
            timestamp: new Date().toISOString()
          };
          
          setConversation(prev => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
            lastUpdated: new Date().toISOString()
          }));
          
          // 🎯 INCREMENT MESSAGE COUNT
          setMessageCount(prev => prev + 1);
        },
        onError: (error: string) => {
          console.error("Message error:", error);
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Sorry, there was an error processing your message. Please try again.',
            timestamp: new Date().toISOString()
          };
          
          setConversation(prev => ({
            ...prev,
            messages: [...prev.messages, errorMessage],
            lastUpdated: new Date().toISOString()
          }));
        }
      });
      
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, there was an unexpected error. Please try again.',
        timestamp: new Date().toISOString()
      };
      
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        lastUpdated: new Date().toISOString()
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo and Brand */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Atlas AI
                </span>
              </div>

              {/* Navigation */}
              <nav className="flex items-center space-x-4">
                <button className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors bg-blue-600/20">
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat</span>
                </button>
                <button className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
                
                {/* 🎯 TIER DISPLAY */}
                <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-700/50">
                  <span className="text-sm font-medium text-blue-400">
                    Atlas {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </span>
                  {tier === 'free' && (
                    <span className="text-xs text-gray-300">
                      {15 - messageCount} left
                    </span>
                  )}
                </div>
              </nav>

              {/* User Menu */}
              <div className="flex items-center space-x-4">
                {user && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium">{user.email}</span>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-red-600 transition-colors bg-red-500/20 hover:bg-red-500/30"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Chat Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
            {/* Chat Messages */}
            <div className="h-[calc(100vh-300px)] min-h-[400px] overflow-y-auto">
              <ConversationView
                conversation={conversation}
                onDeleteMessage={(id) => {
                  setConversation(prev => ({
                    ...prev,
                    messages: prev.messages.filter(msg => msg.id !== id)
                  }));
                }}
                onCopyMessage={(content) => {
                  navigator.clipboard.writeText(content);
                }}
                onUpdateTitle={(title) => {
                  setConversation(prev => ({ ...prev, title }));
                }}
              />
            </div>
            
            {/* Message Input */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  disabled={isProcessing}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim() && !isProcessing) {
                      handleSendMessage(e.currentTarget.value.trim());
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="Type your message..."]') as HTMLInputElement;
                    if (input?.value.trim() && !isProcessing) {
                      handleSendMessage(input.value.trim());
                      input.value = '';
                    }
                  }}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isProcessing ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default ChatPage;
