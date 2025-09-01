import React, { useEffect, useRef } from 'react';
import type { Message } from '../../../types/chat';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  onRetryMessage?: (messageId: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, onRetryMessage }) => {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLastMessage={index === messages.length - 1}
          onRetry={onRetryMessage ? () => onRetryMessage(message.id) : undefined}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
};

export default MessageList;


