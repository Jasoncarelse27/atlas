#!/usr/bin/env bash
set -euo pipefail

log(){ printf "\n\033[1;36m%s\033[0m\n" "$1"; }
ok(){ printf "\033[1;32m%s\033[0m\n" "$1"; }
warn(){ printf "\033[1;33m%s\033[0m\n" "$1"; }

# 0) Go to repo root
git rev-parse --show-toplevel >/dev/null 2>&1 && cd "$(git rev-parse --show-toplevel)"

# 1) Feature branch + backup
log "🔀 Creating feature branch and backing up ConversationView…"
git checkout -b refactor/conversation-view-split || true

TARGET="src/features/chat/components/ConversationView.tsx"
[ -f "$TARGET" ] || { echo "❌ File not found: $TARGET"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups/refactor
cp -f "$TARGET" "backups/refactor/ConversationView.$STAMP.backup.tsx"
ok "Backup saved → backups/refactor/ConversationView.$STAMP.backup.tsx"

# 2) Scaffolding destination
ROOT_DIR="src/features/chat"
DEST_DIR="$ROOT_DIR/components/conversation"
mkdir -p "$DEST_DIR"

# 3) Subcomponent skeletons (minimal, typed, no logic so build won't break)
cat > "$DEST_DIR/ConversationHeader.tsx" <<'TSX'
import React from "react";
import { MessageSquare, Edit3, Check, X } from "lucide-react";

interface ConversationHeaderProps {
  title: string;
  isEditing: boolean;
  editedTitle: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onTitleChange: (title: string) => void;
}

export default function ConversationHeader({
  title,
  isEditing,
  editedTitle,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onTitleChange
}: ConversationHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:border-blue-500"
            placeholder="Enter conversation title"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSaveEdit();
              } else if (e.key === 'Escape') {
                onCancelEdit();
              }
            }}
          />
          <button
            onClick={onSaveEdit}
            className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Check className="w-5 h-5" />
          </button>
          <button
            onClick={onCancelEdit}
            className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            {title}
          </h2>
          <button
            onClick={onStartEdit}
            className="p-1.5 text-gray-400 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
TSX

cat > "$DEST_DIR/MessageBubble.tsx" <<'TSX'
import React from "react";
import { Bot, User, Clock, Copy, Check, Trash2, Share2, Bookmark } from "lucide-react";
import type { Message } from "../../../../types/chat";

interface MessageBubbleProps {
  message: Message;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
}

export default function MessageBubble({ message, copiedId, onCopy, onDelete }: MessageBubbleProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className={`rounded-xl p-4 ${
        message.role === 'user'
          ? 'bg-blue-900/40 border border-blue-800/80 shadow-md' 
          : 'bg-gray-800/90 border border-gray-700 shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`p-2 rounded-full flex-shrink-0 ${
          message.role === 'user' 
            ? 'bg-blue-800/80' 
            : 'bg-purple-800/80'
        }`}>
          {message.role === 'user' ? (
            <User className="w-4 h-4 text-blue-200" />
          ) : (
            <Bot className="w-4 h-4 text-purple-200" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">
                {message.role === 'user' ? 'You' : 'Atlas'}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => onCopy(message.id, message.content)}
                className="p-1 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-700"
              >
                {copiedId === message.id ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              
              {onDelete && (
                <button
                  onClick={() => onDelete(message.id)}
                  className="p-1 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Message Content */}
          <div className="text-gray-200 whitespace-pre-wrap">
            {message.content}
          </div>
          
          {/* Action Buttons */}
          {message.role === 'assistant' && (
            <div className="mt-4 flex items-center gap-2">
              <button className="px-3 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 rounded-lg text-xs flex items-center gap-1 transition-colors border border-gray-600/80">
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </button>
              
              <button className="px-3 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 rounded-lg text-xs flex items-center gap-1 transition-colors border border-gray-600/80">
                <Bookmark className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
TSX

cat > "$DEST_DIR/LoadingMessage.tsx" <<'TSX'
import React from "react";
import { Bot, Clock } from "lucide-react";
import LoadingSpinner from "../../../../components/LoadingSpinner";

export default function LoadingMessage() {
  return (
    <div className="rounded-xl p-4 bg-gray-800/90 border border-gray-700 shadow-md">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-purple-800/80 rounded-full flex-shrink-0">
          <Bot className="w-4 h-4 text-purple-200" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-2">
            <span className="font-medium text-white mr-2">Atlas</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Now
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-300">
            <LoadingSpinner size="sm" />
            <span>Generating response...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
TSX

# 4) Barrel export
cat > "$DEST_DIR/index.ts" <<'TS'
export { default as ConversationHeader } from "./ConversationHeader";
export { default as MessageBubble } from "./MessageBubble";
export { default as LoadingMessage } from "./LoadingMessage";
TS

# 5) Add a non-breaking TODO banner to original file (top comment only)
if ! grep -q "PHASE3_REFACTOR_TODO" "$TARGET"; then
  tmp="$TARGET.tmp.$STAMP"
  {
    echo "/** PHASE3_REFACTOR_TODO: This file is scheduled for modularization."
    echo " *  Use components from src/features/chat/components/conversation as you migrate."
    echo " *  Keep this file as the orchestrator; target < 200 lines."
    echo " */"
    cat "$TARGET"
  } > "$tmp"
  mv "$tmp" "$TARGET"
fi

# 6) Prettify if available
npx --yes prettier "$DEST_DIR" "$TARGET" --write >/dev/null 2>&1 || true

ok "ConversationView scaffold created at $DEST_DIR"
echo "📝 Next:"
echo "  1) Gradually move header/message/loading logic from:"
echo "     $TARGET  →  $DEST_DIR/*  (keep ConversationView as the orchestrator)"
echo "  2) Import from the barrel:"
echo "     import { ConversationHeader, MessageBubble, LoadingMessage } from \"@/features/chat/components/conversation\";"
echo "  3) Commit safely:"
echo "     git add . && git commit -m \"refactor(conversation-view): scaffold subcomponents (no behavior change)\""
