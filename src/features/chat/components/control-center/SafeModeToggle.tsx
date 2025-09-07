import React from "react";
type Props = { value: boolean; onChange: (next: boolean) => void };
export default function SafeModeToggle({ value, onChange }: Props) {
  return (
    <button
      className={
        "text-xs border rounded-full px-3 py-1 " +
        (value ? "bg-green-50" : "bg-transparent")
      }
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      {value ? "Safe Mode: ON" : "Safe Mode: OFF"}
    </button>
  );
}
