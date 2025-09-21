import { Brain, Heart, LogOut, MessageSquare, Settings, User } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useNavigate } from 'react-router-dom';
import MessageErrorBoundary from '../components/MessageErrorBoundary';
import MessageRenderer from '../components/MessageRenderer';
import ChatInputBar from '../features/chat/components/ChatInputBar';
import { supabase } from '../lib/supabase';
import { fetchWithAuthJSON } from '../services/fetchWithAuth';
import { useMessageStore } from '../stores/useMessageStore';
import type { Message } from '../types/chat';

// Error fallback component for production safety
function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="max-w-md mx-auto p-6 bg-gray-800 rounded-lg border border-red-500">
        <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h2>
        <p className="text-gray-300 mb-4">Atlas encountered an unexpected error:</p>
        <pre className="text-sm text-red-300 bg-gray-900 p-3 rounded mb-4 overflow-auto">
          {error.message}
        </pre>
        <div className="flex space-x-3">
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

interface DashboardPageProps {
  user: any;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user }) => {
  const navigate = useNavigate();
  const { clearMessages } = useMessageStore();
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
  
  // Scroll state for smooth ChatGPT-style behavior
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [lastSentMessageId, setLastSentMessageId] = useState<string | null>(null);
  
  // Tier and usage tracking (hardcoded for testing)
  const userTier = 'free'; // TODO: Fetch from user profile
  const [messagesRemaining, setMessagesRemaining] = useState(14);

  // Smooth scroll functions
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setIsAtBottom(true);
    }
  };

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
    setIsAtBottom(nearBottom);
  };

  // Get messages from store for scroll watching
  const { messages: storeMessages } = useMessageStore();
  
  // Auto-scroll when new messages arrive (only if user is at bottom)
  useEffect(() => {
    if (isAtBottom && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [storeMessages, isAtBottom]);

  // Always scroll to bottom when user sends a message
  useEffect(() => {
    if (lastSentMessageId && chatContainerRef.current) {
      scrollToBottom();
    }
  }, [lastSentMessageId]);

  // TODO: Fetch real user tier and usage data
  // useEffect(() => {
  //   // Fetch user profile and usage data
  // }, [user?.id]);

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
      // 🧠 MEMORY: Get stored conversation ID from localStorage
      let conversationId = localStorage.getItem("atlas_conversation_id");
      console.log("🧠 [FRONTEND] Loaded conversationId from localStorage:", conversationId);

      // Fetch user's tier from user_profiles
      let userTier = 'free'; // Default fallback
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const profile = await fetchWithAuthJSON(`${API_URL}/v1/user_profiles/${user.id}`);
        
        if (profile?.subscription_tier) {
          userTier = profile.subscription_tier;
        }
      } catch (tierError) {
        console.warn('Could not fetch user tier, using default:', tierError);
      }

      const requestPayload = {
        message: message,
        userId: user?.id || '65fcb50a-d67d-453e-a405-50c6aef959be',
        tier: userTier,
        conversationId: conversationId || null, // 🧠 Use stored conversation ID
        model: 'claude-3-haiku-20240307' // Default model
      };
      
      console.log("🚀 [FRONTEND] SENDING TO BACKEND:", {
        message: message.slice(0, 30) + '...',
        conversationId: conversationId,
        hasConversationId: !!conversationId,
        fromStorage: localStorage.getItem('atlas_conversation_id')
      });

      // Add user message immediately to message store
      const userMessageId = Date.now().toString();
      const userMessage = {
        id: userMessageId,
        role: 'user' as const,
        content: message,
        timestamp: new Date().toISOString(),
        streaming: false,
        error: null
      };
      
      const { addMessage, updateMessage } = useMessageStore.getState();
      addMessage(userMessage);

      // Create assistant message with streaming placeholder
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant' as const,
        content: '',
        timestamp: new Date().toISOString(),
        streaming: true,
        error: null
      };
      
      addMessage(assistantMessage);

      // Send streaming request to backend
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/message`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-for-development' // TODO: Use real auth token
        },
        body: JSON.stringify(requestPayload)
      });
      
      if (!response.ok) {
        throw new Error(`Backend failed with status ${response.status}`);
      }
      
      const responseData = await response.json();
      
      console.log("📥 [FRONTEND] RECEIVED FROM BACKEND:", {
        hasConversationId: !!responseData.conversationId,
        conversationId: responseData.conversationId,
        preview: responseData.response?.slice(0, 80) + '...'
      });
      
      // 🧠 MEMORY: Store conversation ID if backend provides one
      if (responseData.conversationId) {
        localStorage.setItem("atlas_conversation_id", responseData.conversationId);
        console.log("💾 [FRONTEND] Persisted conversationId:", responseData.conversationId);
      }

      // Simulate streaming effect for the assistant response
      const fullResponse = responseData.response || 'Sorry, I encountered an error.';
      let currentText = '';
      
      for (let i = 0; i < fullResponse.length; i++) {
        currentText += fullResponse[i];
        
        // Update the streaming message
        updateMessage(assistantMessageId, {
          content: currentText,
          streaming: i < fullResponse.length - 1
        });
        
        // Auto-scroll during streaming (every 20 characters for smooth performance)
        if (i % 20 === 0 && isAtBottom) {
          setTimeout(() => {
            if (chatContainerRef.current) {
              chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
          }, 0);
        }
        
        // Small delay to create typing effect (faster for better UX)
        await new Promise(resolve => setTimeout(resolve, 8));
      }
      
      // Final update to mark streaming complete
      updateMessage(assistantMessageId, {
        content: fullResponse,
        streaming: false
      });
      
      // Auto-scroll to bottom after streaming completes
      setTimeout(() => {
        scrollToBottom();
      }, 100);

      // Also update local conversation state for backward compatibility
      const localUserMessage: Message = {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        timestamp: userMessage.timestamp
      };
      
      const localAssistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date().toISOString()
      };
      
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, localUserMessage, localAssistantMessage],
        lastUpdated: new Date().toISOString()
      }));

      console.log("✅ Message sent successfully");
      
      // Update message count for free tier users
      setMessagesRemaining(prev => Math.max(0, prev - 1));
      
    } catch (error) {
      console.error('❌ Error in handleSendMessage:', error);
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
    <ErrorBoundary FallbackComponent={ErrorFallback}>
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
                <button 
                  onClick={() => {
                    console.log('🆕 [FRONTEND] Starting new chat');
                    // Clear stored conversation ID
                    localStorage.removeItem("atlas_conversation_id");
                    console.log("🗑️ [FRONTEND] Cleared conversationId — starting fresh");
                    // Reset conversation state
                    setConversation({
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
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                >
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
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden flex flex-col h-[600px]">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-white">💬 Welcome to Atlas AI</h2>
                  <p className="text-gray-400 text-sm">Your emotionally intelligent AI companion</p>
                </div>
                <button
                  onClick={() => {
                    clearMessages(); // Clear message store
                    // Also clear local conversation state
                    setConversation({
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
                  }}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
                  title="Clear conversation"
                >
                  Clear
                </button>
              </div>
              
              {/* Messages Area with Smooth Scroll */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto relative"
                onScroll={handleChatScroll}
              >
                <MessageErrorBoundary>
                  <div className="pb-20"> {/* Safe padding so last message isn't hidden */}
                    <MessageRenderer />
                  </div>
                </MessageErrorBoundary>
                
                {/* Floating Down Button */}
                {!isAtBottom && (
                  <button
                    onClick={() => {
                      console.log('🔽 Scroll button clicked');
                      scrollToBottom();
                    }}
                    className={`
                      absolute bottom-4 right-4 
                      bg-[#F4E5D9] text-black 
                      rounded-full shadow-lg p-3
                      hover:bg-[#E8D5C4] 
                      transition-all duration-300 z-10
                      ${!isAtBottom ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                    `}
                    title="Scroll to bottom"
                  >
                    ↓
                  </button>
                )}
              </div>
              
              {/* Usage Indicator Footer */}
              
              {/* Enhanced Chat Input Bar with Tier-based Features */}
              <div className="p-4 border-t border-gray-700">
                <ChatInputBar
                  onSendMessage={handleSendMessage}
                  onVoiceTranscription={handleSendMessage}
                  isProcessing={isProcessing}
                  userId={user?.id}
                  tier={userTier}
                  sessionId={conversation?.id || 'default'}
                  placeholder="Ask anything..."
                />
                
                {/* Message counter for free tier */}
                {userTier === "free" && (
                  <div className="mt-2 text-center">
                    <span
                      className={`
                        text-xs font-medium
                        ${messagesRemaining <= 0 ? "text-red-500" :
                          messagesRemaining <= 5 ? "text-yellow-500" :
                          "text-gray-400"}
                      `}
                    >
                      {messagesRemaining} messages remaining today
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </ErrorBoundary>
  );
};

export default DashboardPage;
