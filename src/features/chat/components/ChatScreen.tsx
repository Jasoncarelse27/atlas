import React, { useState } from 'react';
import { handlePrompt, ClaudeResponse } from '@/lib/ClaudeRouter';
import ClaudeResponseView from './ClaudeResponseView';

interface ChatScreenProps {
  userId: string;
}

export default function ChatScreen({ userId }: ChatScreenProps) {
  const [prompt, setPrompt] = useState('');
  const [claudeResponse, setClaudeResponse] = useState<ClaudeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendPrompt = async () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await handlePrompt(prompt, userId);
      setClaudeResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response from Claude');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  };

  return (
    <div className="flex flex-col h-full p-4 max-w-4xl mx-auto">
      <div className="flex-1 overflow-y-auto mb-4">
        {claudeResponse && (
          <ClaudeResponseView response={claudeResponse} />
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 text-sm">Error: {error}</p>
          </div>
        )}
        
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Claude is thinking...</span>
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your prompt..."
          className="flex-1 border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          disabled={isLoading}
        />
        <button
          onClick={sendPrompt}
          disabled={isLoading || !prompt.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
