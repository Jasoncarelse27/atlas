import React from "react";
type Message = {
  id: string | number;
  role: "user" | "assistant" | "system";
  content: string;
};
type Props = {
  messages: Message[];
  bottomRef?: React.RefObject<HTMLDivElement>;
};
export default function MessageList({ messages, bottomRef }: Props) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
      {messages.map((m) => (
        <div
          key={m.id}
          className={m.role === "user" ? "text-right" : "text-left"}
        >
          <div className="inline-block rounded-2xl px-3 py-2 border max-w-[80ch] text-sm">
            {m.content}
          </div>
        </div>
      ))}
      <div ref={bottomRef as any} />
    </div>
  );
}
