#!/usr/bin/env bash
set -euo pipefail

log(){ printf "\n\033[1;36m%s\033[0m\n" "$1"; }
ok(){ printf "\033[1;32m%s\033[0m\n" "$1"; }
warn(){ printf "\033[1;33m%s\033[0m\n" "$1"; }

# 0) Go to repo root
git rev-parse --show-toplevel >/dev/null 2>&1 && cd "$(git rev-parse --show-toplevel)"

# 1) Feature branch + backup
log "🔀 Creating feature branch and backing up…"
git checkout -b refactor/control-center-split || true

# Try to locate ControlCenter.tsx
TARGET="$(git ls-files | grep -E 'ControlCenter\.tsx$' | head -n1 || true)"
if [ -z "$TARGET" ]; then
  warn "Could not find ControlCenter.tsx by name. Using fallback path:"
  TARGET="src/features/chat/ControlCenter.tsx"
fi
[ -f "$TARGET" ] || { echo "❌ File not found: $TARGET"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups/refactor
cp -f "$TARGET" "backups/refactor/ControlCenter.$STAMP.backup.tsx"
ok "Backup saved → backups/refactor/ControlCenter.$STAMP.backup.tsx"

# 2) Scaffolding destination
ROOT_DIR="src/features/chat"
DEST_DIR="$ROOT_DIR/components/control-center"
mkdir -p "$DEST_DIR"

# 3) Subcomponent skeletons (minimal, typed, no logic so build won't break)
cat > "$DEST_DIR/ControlHeader.tsx" <<'TSX'
import React from "react";
type Props = {
  title?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
};
export default function ControlHeader({ title, onBack, rightSlot }: Props) {
  return (
    <header className="flex items-center justify-between px-3 py-2 border-b">
      <button aria-label="Back" onClick={onBack} className="px-2">←</button>
      <h1 className="text-base font-medium truncate">{title ?? "Conversation"}</h1>
      <div className="min-w-[48px] flex justify-end">{rightSlot}</div>
    </header>
  );
}
TSX

cat > "$DEST_DIR/MessageList.tsx" <<'TSX'
import React from "react";
type Message = { id: string | number; role: "user"|"assistant"|"system"; content: string };
type Props = { messages: Message[]; bottomRef?: React.RefObject<HTMLDivElement> };
export default function MessageList({ messages, bottomRef }: Props) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
      {messages.map(m => (
        <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
          <div className="inline-block rounded-2xl px-3 py-2 border max-w-[80ch] text-sm">
            {m.content}
          </div>
        </div>
      ))}
      <div ref={bottomRef as any} />
    </div>
  );
}
TSX

cat > "$DEST_DIR/Composer.tsx" <<'TSX'
import React, { useState } from "react";
type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
  leftSlot?: React.ReactNode;  // e.g., mic button
  rightSlot?: React.ReactNode; // e.g., send/attach
  placeholder?: string;
};
export default function Composer({ onSend, disabled, leftSlot, rightSlot, placeholder }: Props) {
  const [text, setText] = useState("");
  return (
    <div className="border-t p-2 flex items-end gap-2">
      {leftSlot}
      <textarea
        className="flex-1 resize-none rounded-xl border p-2 text-sm"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder ?? "Type your message…"}
        rows={1}
        disabled={disabled}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (text.trim()) { onSend(text.trim()); setText(""); }
          }
        }}
      />
      {rightSlot}
    </div>
  );
}
TSX

cat > "$DEST_DIR/SafeModeToggle.tsx" <<'TSX'
import React from "react";
type Props = { value: boolean; onChange: (next: boolean) => void };
export default function SafeModeToggle({ value, onChange }: Props) {
  return (
    <button
      className={"text-xs border rounded-full px-3 py-1 " + (value ? "bg-green-50" : "bg-transparent")}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      {value ? "Safe Mode: ON" : "Safe Mode: OFF"}
    </button>
  );
}
TSX

cat > "$DEST_DIR/UpgradePrompt.tsx" <<'TSX'
import React from "react";
type Props = { show: boolean; onUpgrade?: () => void; tierLabel?: string };
export default function UpgradePrompt({ show, onUpgrade, tierLabel }: Props) {
  if (!show) return null;
  return (
    <div className="border rounded-xl p-3 mx-3 my-2 text-sm bg-amber-50">
      You are on {tierLabel ?? "Free"} tier. Upgrade for faster responses & higher limits.
      <button className="ml-2 underline" onClick={onUpgrade}>Upgrade</button>
    </div>
  );
}
TSX

# 4) Barrel export
cat > "$DEST_DIR/index.ts" <<'TS'
export { default as ControlHeader } from "./ControlHeader";
export { default as MessageList } from "./MessageList";
export { default as Composer } from "./Composer";
export { default as SafeModeToggle } from "./SafeModeToggle";
export { default as UpgradePrompt } from "./UpgradePrompt";
TS

# 5) Add a non-breaking TODO banner to original file (top comment only)
if ! grep -q "PHASE3_REFACTOR_TODO" "$TARGET"; then
  tmp="$TARGET.tmp.$STAMP"
  {
    echo "/** PHASE3_REFACTOR_TODO: This file is scheduled for modularization."
    echo " *  Use components from src/features/chat/components/control-center as you migrate."
    echo " *  Keep this file as the orchestrator; target < 300 lines."
    echo " */"
    cat "$TARGET"
  } > "$tmp"
  mv "$tmp" "$TARGET"
fi

# 6) Optional: create a tiny story-style playground wrapper (non-breaking)
PLAY="$DEST_DIR/Playground.tsx"
cat > "$PLAY" <<'TSX'
import React, { useRef, useState } from "react";
import { ControlHeader, MessageList, Composer, SafeModeToggle, UpgradePrompt } from ".";
export default function Playground() {
  const [safe, setSafe] = useState(true);
  const [list, setList] = useState([{ id: 1, role: "assistant" as const, content: "Welcome to Atlas!" }]);
  const endRef = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col h-[80vh] border rounded-xl overflow-hidden">
      <ControlHeader title="Control Center (Playground)" rightSlot={<SafeModeToggle value={safe} onChange={setSafe} />} />
      <UpgradePrompt show={false} />
      <MessageList messages={list} bottomRef={endRef} />
      <Composer
        onSend={(t)=> setList(prev => [...prev, { id: prev.length+1, role: "user", content: t }])}
        placeholder="Say something…"
        rightSlot={<button className="border rounded-xl px-3 py-1">Send</button>}
      />
    </div>
  );
}
TSX

# 7) Prettify if available
npx --yes prettier "$DEST_DIR" "$TARGET" --write >/dev/null 2>&1 || true

ok "Scaffold created at $DEST_DIR"
echo "📝 Next:"
echo "  1) Gradually move header/list/composer/safe-mode/upgrade logic from:"
echo "     $TARGET  →  $DEST_DIR/*  (keep ControlCenter as the orchestrator)"
echo "  2) Import from the barrel:"
echo "     import { ControlHeader, MessageList, Composer, SafeModeToggle, UpgradePrompt } from \"@/features/chat/components/control-center\";"
echo "  3) Commit safely:"
echo "     git add . && git commit -m \"refactor(control-center): scaffold subcomponents (no behavior change)\""
