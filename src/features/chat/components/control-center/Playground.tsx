import React, { useRef, useState } from "react";
import {
  ControlHeader,
  MessageList,
  Composer,
  SafeModeToggle,
  UpgradePrompt,
} from ".";
export default function Playground() {
  const [safe, setSafe] = useState(true);
  const [list, setList] = useState([
    { id: 1, role: "assistant" as const, content: "Welcome to Atlas!" },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col h-[80vh] border rounded-xl overflow-hidden">
      <ControlHeader
        title="Control Center (Playground)"
        rightSlot={<SafeModeToggle value={safe} onChange={setSafe} />}
      />
      <UpgradePrompt show={false} />
      <MessageList messages={list} bottomRef={endRef} />
      <Composer
        onSend={(t) =>
          setList((prev) => [
            ...prev,
            { id: prev.length + 1, role: "user", content: t },
          ])
        }
        placeholder="Say something…"
        rightSlot={
          <button className="border rounded-xl px-3 py-1">Send</button>
        }
      />
    </div>
  );
}
