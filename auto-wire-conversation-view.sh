#!/usr/bin/env bash
set -euo pipefail

log(){ printf "\n\033[1;36m%s\033[0m\n" "$1"; }
ok(){ printf "\033[1;32m%s\033[0m\n" "$1"; }
warn(){ printf "\033[1;33m%s\033[0m\n" "$1"; }

# 0) Repo root
git rev-parse --show-toplevel >/dev/null 2>&1 && cd "$(git rev-parse --show-toplevel)"

# 1) Locate ConversationView.tsx
TARGET="src/features/chat/components/ConversationView.tsx"
[ -f "$TARGET" ] || { echo "❌ File not found: $TARGET"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups/refactor
cp -f "$TARGET" "backups/refactor/ConversationView.$STAMP.backup.tsx"
ok "Backup saved → backups/refactor/ConversationView.$STAMP.backup.tsx"

# 2) Insert import block after the last import (if not already present)
TARGET="$TARGET" node - <<'NODE'
const fs = require('fs');
const TARGET = process.env.TARGET;
const IMPORT_LINE = `import { ConversationHeader, MessageBubble, LoadingMessage } from "@/features/chat/components/conversation";`;

let src = fs.readFileSync(TARGET, 'utf8');

// If import already exists, skip insertion
if (!src.includes(IMPORT_LINE)) {
  const lines = src.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s+/.test(lines[i])) lastImportIdx = i;
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, IMPORT_LINE);
    src = lines.join('\n');
  } else {
    // No imports found; prepend
    src = IMPORT_LINE + '\n' + src;
  }
  fs.writeFileSync(TARGET, src, 'utf8');
  console.log('✅ Added imports for conversation components');
} else {
  console.log('ℹ️ Imports already present — skipping');
}
NODE

# 3) Append a NON-EXECUTING scaffold (once). Keeps build identical but shows how to wire.
TARGET="$TARGET" node - <<'NODE'
const fs = require('fs');
const TARGET = process.env.TARGET;

let src = fs.readFileSync(TARGET, 'utf8');
if (src.includes('PHASE3_AUTOWIRE_SCAFFOLD')) {
  console.log('ℹ️ Scaffold already present — skipping');
  process.exit(0);
}

const scaffold = `
/* PHASE3_AUTOWIRE_SCAFFOLD (non-executing)
  How to migrate ConversationView.tsx with new components:

  1) State management (already exists):
     const [copiedId, setCopiedId] = useState<string | null>(null);
     const [isEditingTitle, setIsEditingTitle] = useState(false);
     const [editedTitle, setEditedTitle] = useState(conversation.title);

  2) Use the components (drop this block into your JSX and remove the {false && …} guard):
     {false && (
       <div className="w-full space-y-6">
         <ConversationHeader
           title={conversation.title}
           isEditing={isEditingTitle}
           editedTitle={editedTitle}
           onStartEdit={() => setIsEditingTitle(true)}
           onSaveEdit={() => {
             if (editedTitle.trim() && onUpdateTitle) {
               onUpdateTitle(editedTitle.trim());
             }
             setIsEditingTitle(false);
           }}
           onCancelEdit={() => setIsEditingTitle(false)}
           onTitleChange={setEditedTitle}
         />
         
         {conversation.messages.filter(m => m.role !== 'system').map((message) => (
           <MessageBubble
             key={message.id}
             message={message}
             copiedId={copiedId}
             onCopy={handleCopy}
             onDelete={onDeleteMessage}
           />
         ))}
         
         {isLoading && <LoadingMessage />}
       </div>
     )}
  3) Migrate gradually:
     - Move title editing logic → ConversationHeader
     - Move message rendering → MessageBubble
     - Move loading state → LoadingMessage
  4) Keep this file as the orchestrator (target < 200 lines).
*/
`;

fs.writeFileSync(TARGET, src + '\n' + scaffold, 'utf8');
console.log('✅ Appended non-executing scaffold to ConversationView.tsx');
NODE

# 4) Prettify if available
npx --yes prettier "$TARGET" --write >/dev/null 2>&1 || true

ok "Auto-wiring complete (imports + scaffold, zero runtime change)."
echo "📝 Next:"
echo "  • Open $TARGET and search for PHASE3_AUTOWIRE_SCAFFOLD"
echo "  • Copy the JSX out of {false && (...)} into your render and remove the guard"
echo "  • Migrate logic piece-by-piece; commit in small steps."
