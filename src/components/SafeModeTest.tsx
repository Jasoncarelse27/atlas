import React, { useState } from 'react';
import { useSafeMode } from '../context/SafeModeContext';
import useSendMessage from '../hooks/useSendMessage';
import type { Message } from '../types/chat';

const SafeModeTest: React.FC = () => {
  const { isSafeMode, toggleSafeMode } = useSafeMode();
  const [testMessage, setTestMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  
  const { sendMessage, isSending, error, clearError } = useSendMessage(
    (message) => {
      setMessages(prev => [...prev, message]);
    }
  );

  return (
    <div className="p-6 bg-gray-800 rounded-lg max-w-md mx-auto">
      <h2 className="text-xl font-bold text-white mb-4">SafeSpace Mode Test</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Status:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isSafeMode 
              ? 'bg-red-600 text-white' 
              : 'bg-green-600 text-white'
          }`}>
            {isSafeMode ? '🔒 SafeSpace ON' : '🔓 SafeSpace OFF'}
          </span>
        </div>
        
        <button
          onClick={toggleSafeMode}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {isSafeMode ? 'Disable SafeSpace' : 'Enable SafeSpace'}
        </button>
        
        <div className="text-sm text-gray-400">
          <p className="mb-2">
            <strong>When SafeSpace is ON:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Messages are not saved to server</li>
            <li>Conversations stay local only</li>
            <li>Enhanced privacy protection</li>
          </ul>
        </div>
        
        <div className="text-sm text-gray-400">
          <p className="mb-2">
            <strong>When SafeSpace is OFF:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Messages saved normally to Supabase</li>
            <li>Full conversation history available</li>
            <li>Standard functionality</li>
          </ul>
        </div>
      </div>

      {/* Message Testing Section */}
      <div className="mt-6 p-4 bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-3">Test Message Sending</h3>
        
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Type a test message..."
              className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                if (testMessage.trim()) {
                  sendMessage(testMessage);
                  setTestMessage('');
                }
              }}
              disabled={isSending || !testMessage.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white rounded-lg transition-colors"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-600/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={clearError}
                className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
              >
                Clear Error
              </button>
            </div>
          )}

          {/* Messages Display */}
          {messages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-md font-medium text-white">Test Messages:</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {messages.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className={`p-2 rounded-lg text-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600/20 border border-blue-500/50' 
                        : 'bg-green-600/20 border border-green-500/50'
                    }`}
                  >
                    <div className="font-medium text-gray-300 mb-1">
                      {msg.role === 'user' ? '👤 You' : '🤖 Assistant'}
                    </div>
                    <div className="text-white">
                      {msg.content.type === 'text' ? msg.content.text : 'Unsupported content type'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SafeModeTest;
