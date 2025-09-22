import React from 'react';
import InputToolbar from '../../../components/chat/InputToolbar';

interface ChatInputBarProps {
  onSendMessage: (message: string) => void;
  onVoiceTranscription?: (text: string) => void;
  isProcessing: boolean;
  disabled?: boolean;
  userId?: string;
  tier?: "free" | "core" | "studio";
  sessionId?: string;
  placeholder?: string;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendMessage,
  onVoiceTranscription,
  isProcessing,
  disabled = false,
  userId,
  tier = "free",
  sessionId,
  placeholder = "Ask anything..."
}) => {
  return (
    <InputToolbar
      onSendMessage={onSendMessage}
      onVoiceTranscription={onVoiceTranscription}
      isProcessing={isProcessing}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
};