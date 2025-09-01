import React from 'react';
import { Send, Mic } from 'lucide-react';
import VoiceInput from './VoiceInput';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onVoiceTranscription: (text: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ value, onChange, onSend, onVoiceTranscription, disabled = false }) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const hasText = value.trim().length > 0;

  return (
    <div className="p-4 border-t border-gray-200">
      <div className="flex gap-3">
        <div className="flex-1">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-2">
          {hasText ? (
            <button
              onClick={onSend}
              disabled={disabled}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
            >
              {disabled ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Send
                </div>
              )}
            </button>
          ) : (
            <VoiceInput onTranscriptionComplete={onVoiceTranscription} disabled={disabled} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;


