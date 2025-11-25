# ✅ CURSOR ONE-PROMPT — Fix Atlas Response Formatting (Emoji, Spacing, Markdown)

You are fixing formatting issues in Atlas AI responses:
- ❌ Emoji at start of every message
- ❌ Broken spacing (e.g., "Wh ichfeels", "WhichFeels" → should be "Which feels")
- ❌ Raw markdown showing up (e.g., `**` appearing in output)

---

## 🎯 Target Files

Work ONLY in these files:
1. `src/utils/cleanMarkdown.ts` (CREATE this file)
2. `src/components/chat/MessageRenderer.tsx` (MODIFY)
3. `src/components/chat/EnhancedMessageBubble.tsx` (MODIFY)
4. `backend/services/promptOrchestrator.mjs` (MODIFY - remove emoji-start instructions if any)

---

## 🔧 PART 1: Create cleanMarkdown Utility

**File:** `src/utils/cleanMarkdown.ts`

Create this file with the following content:

```typescript
/**
 * Clean markdown and fix spacing in Atlas assistant responses
 * Removes raw markdown, fixes glued words, normalizes spacing
 */
export function cleanMarkdown(text: string): string {
  if (!text) return "";

  return text
    // Remove bold markdown: **text** → text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    // Remove italics markdown: *text* → text
    .replace(/\*(.*?)\*/g, "$1")
    // Remove underline markdown: __text__ → text
    .replace(/__(.*?)__/g, "$1")
    // Remove inline code markdown: `text` → text
    .replace(/`(.*?)`/g, "$1")
    // Remove stray markdown characters (#, >, -) that aren't part of structure
    .replace(/^[#>\-]+\s*/gm, "")
    // Fix glued words: WhichFeels → Which Feels, Doa → Do a
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Fix glued words with numbers: Even10 → Even 10
    .replace(/([a-z])([0-9])/g, "$1 $2")
    // Normalize multiple spaces to single space
    .replace(/\s+/g, " ")
    // Trim leading/trailing whitespace
    .trim();
}

/**
 * Remove emoji from start of text (if present)
 * Keeps emojis in the middle/end, only removes leading emoji
 */
export function removeLeadingEmoji(text: string): string {
  if (!text) return "";
  
  // Match emoji at start (Unicode emoji ranges)
  // This pattern matches most common emojis
  const emojiPattern = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\s]+/u;
  
  return text.replace(emojiPattern, "").trim();
}

/**
 * Combined cleaning function for assistant messages
 * Applies all formatting fixes in correct order
 */
export function cleanAssistantMessage(text: string): string {
  if (!text) return "";
  
  // Step 1: Remove leading emoji
  let cleaned = removeLeadingEmoji(text);
  
  // Step 2: Clean markdown and fix spacing
  cleaned = cleanMarkdown(cleaned);
  
  return cleaned;
}
```

---

## 🔧 PART 2: Apply cleanMarkdown to MessageRenderer

**File:** `src/components/chat/MessageRenderer.tsx`

**Location:** Around line 239 where content is extracted

**Change:**

Find this section:
```typescript
// Handle text content (default)
const content = Array.isArray(message.content) ? message.content.join(' ') : message.content;
```

**Replace with:**
```typescript
// Handle text content (default)
let content = Array.isArray(message.content) ? message.content.join(' ') : message.content;

// ✅ CRITICAL FIX: Clean markdown and spacing for assistant messages only
if (message.role === 'assistant' && typeof content === 'string') {
  const { cleanAssistantMessage } = await import('../../utils/cleanMarkdown');
  content = cleanAssistantMessage(content);
}
```

**IMPORTANT:** Since this is inside a component, use a static import instead:

**Better approach - use static import at top:**
```typescript
import { cleanAssistantMessage } from '../../utils/cleanMarkdown';
```

Then modify the content extraction:
```typescript
// Handle text content (default)
let content = Array.isArray(message.content) ? message.content.join(' ') : message.content;

// ✅ CRITICAL FIX: Clean markdown and spacing for assistant messages only
if (message.role === 'assistant' && typeof content === 'string') {
  content = cleanAssistantMessage(content);
}
```

---

## 🔧 PART 3: Apply cleanMarkdown to EnhancedMessageBubble

**File:** `src/components/chat/EnhancedMessageBubble.tsx`

**Location:** Around line 127 where `messageContent` is computed

**Change:**

Add import at top:
```typescript
import { cleanAssistantMessage } from '../../utils/cleanMarkdown';
```

Find the `messageContent` IIFE (around line 127):
```typescript
const messageContent = (() => {
  if (!message.content) return '';
  // ... existing logic ...
})();
```

**Modify the return statement** to clean assistant messages:

Find where it returns the final string (around line 160):
```typescript
return message.content;
```

**Replace with:**
```typescript
// ✅ CRITICAL FIX: Clean markdown and spacing for assistant messages
if (message.role === 'assistant' && typeof message.content === 'string') {
  return cleanAssistantMessage(message.content);
}
return message.content;
```

**Also clean the `displayedText`** - find where `displayedText` is set from `messageContent` (around line 466-486):

After the typing effect logic, ensure displayedText is cleaned:
```typescript
// For assistant messages, clean before displaying
if (!isUser && displayedText) {
  displayedText = cleanAssistantMessage(displayedText);
}
```

**Actually, better approach:** Clean `messageContent` once at the top, then all downstream uses will be clean.

**Modify the messageContent IIFE to clean at the end:**
```typescript
const messageContent = (() => {
  if (!message.content) return '';
  
  // ... existing extraction logic ...
  
  // Get final text
  let finalText = /* ... existing logic that extracts text ... */;
  
  // ✅ CRITICAL FIX: Clean markdown and spacing for assistant messages
  if (message.role === 'assistant' && typeof finalText === 'string') {
    finalText = cleanAssistantMessage(finalText);
  }
  
  return finalText;
})();
```

---

## 🔧 PART 4: Remove Emoji-Start Instructions from Backend Prompts

**File:** `backend/services/promptOrchestrator.mjs`

**Location:** Around line 34 where emoji instructions are

**Change:**

Find this line (around line 34):
```javascript
• Use **emoji section icons** that match the topic (🔥🎯💡⚠️📌📊🧠✨)
```

**Keep this line** - it's fine (section icons are OK).

**Search for any instructions that say:**
- "Start with emoji"
- "Begin with emoji"
- "Start responses with"
- "Begin each response with"

**If found, REMOVE those lines.** The current prompt (line 34) only mentions emoji section icons, which is fine.

**DO NOT remove:**
- Emoji section icons instruction (line 34) - this is for section headers, not message starts
- Any other formatting instructions

---

## 🔧 PART 5: Verify No Double-Cleaning

**Important:** Ensure we don't clean the same text twice.

**Check:**
- MessageRenderer cleans content before passing to ReactMarkdown
- EnhancedMessageBubble cleans messageContent once at extraction
- Both only clean assistant messages (not user messages)

---

## 📌 After Refactor

1. **Run TypeScript check:**
```bash
npm run typecheck
```

2. **Run build:**
```bash
npm run build
```

3. **Fix any import errors** - ensure `cleanMarkdown.ts` is properly exported

---

## 📜 Output Required

At the end, provide a summary:
- ✅ Created `src/utils/cleanMarkdown.ts` with 3 functions
- ✅ Modified `MessageRenderer.tsx` to clean assistant content
- ✅ Modified `EnhancedMessageBubble.tsx` to clean assistant content
- ✅ Verified backend prompts don't instruct emoji-at-start
- ✅ Confirmed no double-cleaning occurs

---

## 🎯 Expected Results

After this fix:
- ✅ No emoji at start of messages
- ✅ No raw `**` markdown showing
- ✅ Proper spacing ("Which feels" not "WhichFeels")
- ✅ Clean, professional Atlas responses

---

**End of Cursor Prompt**

