import React from "react";
type Props = { show: boolean; onUpgrade?: () => void; tierLabel?: string };
export default function UpgradePrompt({ show, onUpgrade, tierLabel }: Props) {
  if (!show) return null;
  return (
    <div className="border rounded-xl p-3 mx-3 my-2 text-sm bg-amber-50">
      You are on {tierLabel ?? "Free"} tier. Upgrade for faster responses &
      higher limits.
      <button className="ml-2 underline" onClick={onUpgrade}>
        Upgrade
      </button>
    </div>
  );
}
