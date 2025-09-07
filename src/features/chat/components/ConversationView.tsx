/** PHASE3_REFACTOR_TODO: This file is scheduled for modularization.
 *  Use components from src/features/chat/components/conversation as you migrate.
 *  Keep this file as the orchestrator; target < 200 lines.
 */
import {
    ConversationHeader,
    LoadingMessage,
    MessageBubble,
} from "@/features/chat/components/conversation";
import React, { useEffect, useRef, useState } from "react";
import type { Message } from "../../../types/chat";

interface ConversationViewProps {
  conversation: {
    id: string;
    title: string;
    messages: Message[];
    lastUpdated: string;
    createdAt: string;
    pinned?: boolean;
  };
  isLoading?: boolean;
  onDeleteMessage?: (id: string) => void;
  onCopyMessage?: (content: string) => void;
  className?: string;
  onUpdateTitle?: (title: string) => void;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
}

const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  isLoading = false,
  onDeleteMessage,
  onCopyMessage,
  className = "",
  onUpdateTitle,
  messagesEndRef,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(conversation.title);
  const endRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change or loading state changes
  useEffect(() => {
    if (messagesEndRef?.current || endRef.current) {
      const ref = messagesEndRef?.current || endRef.current;
      ref?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation.messages, isLoading, messagesEndRef]);


  const handleCopy = (id: string, content: string) => {
    if (onCopyMessage) {
      onCopyMessage(content);
    } else {
      navigator.clipboard.writeText(content);
    }

    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEditTitle = () => {
    setEditedTitle(conversation.title);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (editedTitle.trim() && onUpdateTitle) {
      onUpdateTitle(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };


  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Conversation Header */}
      <ConversationHeader
        title={conversation.title}
        isEditing={isEditingTitle}
        editedTitle={editedTitle}
        onStartEdit={handleStartEditTitle}
        onSaveEdit={handleSaveTitle}
        onCancelEdit={() => setIsEditingTitle(false)}
        onTitleChange={setEditedTitle}
      />

      {conversation.messages
        .filter((m) => m.role !== "system")
        .map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            copiedId={copiedId}
            onCopy={handleCopy}
            onDelete={onDeleteMessage}
          />
        ))}

      {/* Loading Message */}
      {isLoading && <LoadingMessage />}

      {/* Scroll anchor */}
      <div ref={endRef} />
    </div>
  );
};

export default ConversationView;

