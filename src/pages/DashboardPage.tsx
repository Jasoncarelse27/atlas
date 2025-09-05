import { Brain, Heart, LogOut, MessageSquare, Settings, User } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConversationView from '../features/chat/components/ConversationView';
import { supabase } from '../lib/supabase';
import { sendMessageToSupabase } from '../services/chatService';
import type { Message } from '../types/chat';

interface DashboardPageProps {
  user: any;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user }) => {
  const navigate = useNavigate();
  const [conversation, setConversation] = useState({
    id: 'default',
    title: 'Welcome to Atlas AI',
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
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (isProcessing || !message.trim()) return;
    
    setIsProcessing(true);
    
    try {
      // Use the real chat service to send the message
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      if (!accessToken) {
        throw new Error("No access token available");
      }

      await sendMessageToSupabase({
        message: message,
        conversationId: conversation.id,
        accessToken: accessToken,
        onMessage: (partial: string) => {
          // Handle streaming message updates
          console.log("Partial message:", partial);
        },
        onComplete: (full: string) => {
          // Handle message completion
          console.log("Message complete:", full);
        },
        onError: (error: string) => {
          console.error("Message error:", error);
        }
      });

      // Message sent successfully
      console.log("Message sent successfully");
      
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
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
              <button className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                <Heart className="w-4 h-4" />
                <span>Insights</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {/* SafeMode Toggle */}
              <div className="flex items-center space-x-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSafeMode}
                    onChange={(e) => setIsSafeMode(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-6 h-6 rounded border-2 border-gray-400 flex items-center justify-center transition-all duration-200 ${
                    isSafeMode ? 'bg-green-500 border-green-500' : 'bg-transparent'
                  }`}>
                    {isSafeMode && <span className="text-white text-xs">🔒</span>}
                  </div>
                </label>
                <span className="text-xs text-gray-400">
                  {isSafeMode ? 'SafeSpace' : 'Normal'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium">{user?.email}</span>
              </div>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors">
                  Start New Chat
                </button>
                <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors">
                  View History
                </button>
                <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors">
                  Emotional Insights
                </button>
              </div>
              
              {/* SafeMode Status */}
              <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Privacy Mode</h4>
                <p className="text-xs text-gray-300">
                  {isSafeMode 
                    ? '🔒 SafeSpace Mode: Messages stored locally only'
                    : '🌐 Normal Mode: Messages may be processed by AI services'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
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
              
              {/* Simple Input */}
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
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {isProcessing ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
