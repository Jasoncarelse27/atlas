import { Send } from 'lucide-react';
import React from 'react';
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
            className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-atlas-sage focus:border-transparent max-h-32 overflow-y-auto"
            rows={1}
            disabled={disabled}
            style={{ minHeight: '44px', maxHeight: '128px' }}
          />
        </div>
        <div className="flex flex-col gap-2">
          {hasText ? (
            <button
              onClick={onSend}
              disabled={disabled}
              className="w-10 h-10 bg-atlas-sage text-white rounded-full hover:bg-atlas-success disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center flex-shrink-0"
            >
              {disabled ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-4 h-4" />
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


