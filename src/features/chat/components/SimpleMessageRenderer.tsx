import React from 'react';

export type ChatMessage = {
  id: string | number;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export interface SimpleMessageRendererProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}

const bubbleBase =
  "max-w-[80%] rounded-2xl px-3 py-2 my-1 whitespace-pre-wrap break-words";
const userBubble = "self-end bg-blue-600 text-white " + bubbleBase;
const asstBubble = "self-start bg-neutral-100 text-neutral-900 " + bubbleBase;
const sysBubble  = "self-center text-xs text-neutral-500 italic my-2";

export default function SimpleMessageRenderer({
  messages,
  isLoading,
  emptyState,
  onRetry,
  className,
}: SimpleMessageRendererProps) {
  if (!messages?.length) {
    return (
      <div className={"flex items-center justify-center h-full text-neutral-500 " + (className ?? '')}>
        {emptyState ?? "No messages yet."}
      </div>
    );
  }

  return (
    <div className={"flex flex-col gap-1 " + (className ?? '')} data-testid="message-renderer">
      {messages.map((m) => {
        if (m.role === 'system') {
          return <div key={String(m.id)} className={sysBubble}>{m.content}</div>;
        }
        const cls = m.role === 'user' ? userBubble : asstBubble;
        return (
          <div key={String(m.id)} className="flex">
            <div className={cls}>{m.content}</div>
          </div>
        );
      })}
      {isLoading && (
        <div className="self-start text-sm text-neutral-500 animate-pulse">Thinking…</div>
      )}
      {!!onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="self-center mt-2 text-xs text-blue-600 hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
