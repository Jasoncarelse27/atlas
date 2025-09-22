import { motion } from 'framer-motion';
import { useState } from 'react';
import EnhancedUpgradeModal from '../components/EnhancedUpgradeModal';
import EnhancedInputToolbar from '../components/chat/EnhancedInputToolbar';
import EnhancedMessageBubble from '../components/chat/EnhancedMessageBubble';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

export default function EnhancedUIDemo() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm Atlas, your emotionally intelligent AI assistant. I'm here to help you with emotional support, personal growth, and meaningful conversations.",
      role: 'assistant',
      timestamp: new Date().toISOString()
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    // Simulate AI response with typing effect
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Thank you for your message! This is a demo of the enhanced Atlas UI with modern design, smooth animations, and tier-based feature access. The interface includes voice recording, image upload, and premium upgrade flows. Notice the typing effect as I respond! ✨",
        role: 'assistant',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsProcessing(false);
    }, 1000);
  };

  const handleVoiceTranscription = (text: string) => {
    handleSendMessage(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Atlas Enhanced UI Demo</h1>
              <p className="text-gray-400">Modern chat interface with tier enforcement</p>
            </div>
            <button
              onClick={() => setUpgradeModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#B2BDA3] to-[#F4E5D9] text-gray-900 font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Try Upgrade Flow
            </button>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((message, index) => (
              <EnhancedMessageBubble
                key={message.id}
                message={message}
                isLatest={index === messages.length - 1}
                isTyping={index === messages.length - 1 && message.role === 'assistant' && !isProcessing}
              />
            ))}
            
            {/* Typing Indicator */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start space-x-3"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B2BDA3] to-[#F4E5D9] flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="flex-1 max-w-3xl">
                  <div className="px-4 py-3 bg-gradient-to-br from-[#B2BDA3]/10 to-[#F4E5D9]/10 border border-[#B2BDA3]/20 rounded-2xl rounded-bl-md">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-[#B2BDA3] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-[#B2BDA3] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-[#B2BDA3] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Enhanced Input Toolbar */}
        <div className="border-t border-gray-700/50 bg-gray-800/30 backdrop-blur-sm">
          <EnhancedInputToolbar
            onSendMessage={handleSendMessage}
            onVoiceTranscription={handleVoiceTranscription}
            isProcessing={isProcessing}
            placeholder="Ask Atlas anything..."
          />
        </div>
      </div>

      {/* Upgrade Modal */}
      <EnhancedUpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature="voice recording"
      />
    </div>
  );
}
