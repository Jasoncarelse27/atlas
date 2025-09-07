import React, { useState } from "react";
type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
  leftSlot?: React.ReactNode; // e.g., mic button
  rightSlot?: React.ReactNode; // e.g., send/attach
  placeholder?: string;
};
export default function Composer({
  onSend,
  disabled,
  leftSlot,
  rightSlot,
  placeholder,
}: Props) {
  const [text, setText] = useState("");
  return (
    <div className="border-t p-2 flex items-end gap-2">
      {leftSlot}
      <textarea
        className="flex-1 resize-none rounded-xl border p-2 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? "Type your message…"}
        rows={1}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (text.trim()) {
              onSend(text.trim());
              setText("");
            }
          }
        }}
      />
      {rightSlot}
    </div>
  );
}
