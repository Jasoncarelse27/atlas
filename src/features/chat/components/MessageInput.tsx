import React from 'react';
import ChatInputBar from './ChatInputBar';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onVoiceTranscription?: (text: string) => void;
  isProcessing: boolean;
  disabled?: boolean;
  userId?: string;
  tier?: "free" | "core" | "studio";
  sessionId?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onVoiceTranscription,
  isProcessing,
  disabled = false,
  userId,
  tier = "free",
  sessionId
}) => {
  return (
    <ChatInputBar
      onSendMessage={onSendMessage}
      onVoiceTranscription={onVoiceTranscription}
      isProcessing={isProcessing}
      disabled={disabled}
      userId={userId}
      tier={tier}
      sessionId={sessionId}
      placeholder="Type your message..."
    />
  );
};
