import React from "react";
type Props = {
  title?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
};
export default function ControlHeader({ title, onBack, rightSlot }: Props) {
  return (
    <header className="flex items-center justify-between px-3 py-2 border-b">
      <button aria-label="Back" onClick={onBack} className="px-2">
        ←
      </button>
      <h1 className="text-base font-medium truncate">
        {title ?? "Conversation"}
      </h1>
      <div className="min-w-[48px] flex justify-end">{rightSlot}</div>
    </header>
  );
}
