import React from 'react';
import type { Message } from '../../../types/chat';
import MessageRenderer from './MessageRenderer';

interface MessageBubbleProps {
  message: Message;
  isLastMessage?: boolean;
  onRetry?: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLastMessage = false, onRetry }) => {
  return (
    <MessageRenderer message={message} isLastMessage={isLastMessage} onRetry={onRetry} />
  );
};

export default MessageBubble;


