import React from 'react';

export interface SimpleInputToolbarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onStop?: () => void;
  isStreaming?: boolean;
}

export default function SimpleInputToolbar({
  value,
  onChange,
  onSubmit,
  placeholder = "Type a message…",
  disabled,
  className,
  onStop,
  isStreaming,
}: SimpleInputToolbarProps) {
  return (
    <div className={"w-full flex items-end gap-2 p-2 border-t border-neutral-200 " + (className ?? '')}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {!isStreaming ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="rounded-xl px-3 py-2 bg-blue-600 text-white disabled:opacity-50"
        >
          Send
        </button>
      ) : (
        <button
          type="button"
          onClick={onStop}
          className="rounded-xl px-3 py-2 bg-neutral-200 text-neutral-900"
        >
          Stop
        </button>
      )}
    </div>
  );
}
