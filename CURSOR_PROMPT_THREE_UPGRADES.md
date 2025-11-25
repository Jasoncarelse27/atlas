# ✅ CURSOR ONE-PROMPT — Three Production-Ready Upgrades

**Launch Day Priority:** Implement all 3 upgrades safely, comprehensively, in one pass.

---

## 🎯 Target: Three Upgrades

1. **Smart Paragraph Formatting** — Enhance system prompt
2. **Tone Personalization** — Add UI + backend integration
3. **Contextual Memory** — Limit to last 8 messages

---

## 📁 Files to Modify

1. `backend/services/promptOrchestrator.mjs` — Add paragraph formatting rules
2. `src/components/ControlCenter.tsx` — Add tone preference UI
3. `src/hooks/useCustomization.ts` — Add tone_preference to preferences type
4. `src/services/chatService.ts` — Pass tone preference to backend
5. `backend/server.mjs` — Use tone preference + limit history to 8 messages

---

## 🔧 PART 1: Smart Paragraph Formatting (System Prompt)

**File:** `backend/services/promptOrchestrator.mjs`

**Location:** After line 37 (after "Write naturally, warmly, professionally")

**Add this new section:**

```javascript
----------------------------------

📝 FORMAT RULES (STRICT)

----------------------------------

When writing responses, ALWAYS follow these formatting rules:

• Write in clean, short paragraphs (1–3 sentences each)
• Separate paragraphs with one blank line
• Never start a paragraph with an emoji
• Avoid heavy markdown (no **bold** unless critical for emphasis)
• Use light, natural formatting — never walls of text
• Keep paragraphs scannable and user-friendly

These rules ensure professional, readable output that matches premium quality standards.

----------------------------------
```

**DO NOT remove existing formatting rules** — this enhances them.

---

## 🔧 PART 2: Tone Personalization (Frontend UI)

### 2A: Update TypeScript Interface

**File:** `src/hooks/useCustomization.ts`

**Location:** Around line 26-40 (preferences interface)

**Find:**
```typescript
preferences: {
  language: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  autoSave: boolean;
  notifications: boolean;
  soundEffects: boolean;
  keyboardShortcuts: boolean;
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reduceMotion: boolean;
    screenReader: boolean;
  };
};
```

**Add `tone_preference` field:**
```typescript
preferences: {
  language: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  autoSave: boolean;
  notifications: boolean;
  soundEffects: boolean;
  keyboardShortcuts: boolean;
  tone_preference?: 'warm' | 'direct' | 'neutral' | 'creative'; // ✅ NEW: Tone preference
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reduceMotion: boolean;
    screenReader: boolean;
  };
};
```

**Also update default customization** (around line 230-245):

**Find:**
```typescript
preferences: {
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/DD/YYYY',
  numberFormat: 'en-US',
  autoSave: true,
  notifications: true,
  soundEffects: true,
  keyboardShortcuts: true,
  accessibility: {
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    screenReader: false
  }
},
```

**Add default tone:**
```typescript
preferences: {
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/DD/YYYY',
  numberFormat: 'en-US',
  autoSave: true,
  notifications: true,
  soundEffects: true,
  keyboardShortcuts: true,
  tone_preference: 'warm', // ✅ NEW: Default to warm tone
  accessibility: {
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    screenReader: false
  }
},
```

### 2B: Add Tone Preference UI to ControlCenter

**File:** `src/components/ControlCenter.tsx`

**Location:** In `renderPreferencesTab()` function, after "Behavior" section (around line 865)

**Add new section before "Import/Export":**

```typescript
{/* AI Response Style */}
<div>
  <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Response Style</h3>
  
  <div className="space-y-4">
    {/* Tone Preference */}
    <div>
      <h4 className="font-medium text-gray-700 mb-2">Response Tone</h4>
      <p className="text-sm text-gray-600 mb-3">Choose how Atlas responds to you</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { 
            value: 'warm', 
            label: 'Warm & Supportive', 
            description: 'Friendly, kind, encouraging' 
          },
          { 
            value: 'direct', 
            label: 'Direct & Concise', 
            description: 'Structured, efficient, minimal emotion' 
          },
          { 
            value: 'neutral', 
            label: 'Neutral Professional', 
            description: 'Balanced and factual' 
          },
          { 
            value: 'creative', 
            label: 'Creative & Playful', 
            description: 'Metaphorical, imaginative' 
          }
        ].map((tone) => (
          <button
            key={tone.value}
            onClick={() => updateCustomization('preferences.tone_preference', tone.value)}
            className={`p-3 border rounded-lg text-left transition-colors ${
              customization?.preferences?.tone_preference === tone.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
            }`}
          >
            <div className="font-medium text-sm text-gray-900 dark:text-white">{tone.label}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{tone.description}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
</div>
```

---

## 🔧 PART 3: Pass Tone Preference to Backend

**File:** `src/services/chatService.ts`

**Location:** Around line 234-239 (where body is stringified)

**Find:**
```typescript
body: JSON.stringify({ 
  message: text,
  conversationId: conversationId || null,
  timezone: getClientTimezone()
}),
```

**Replace with:**
```typescript
// ✅ NEW: Get tone preference from customization
const getTonePreference = (): string | undefined => {
  try {
    const customizationStr = localStorage.getItem(`atlas-customization-${userId}`);
    if (customizationStr) {
      const customization = JSON.parse(customizationStr);
      return customization?.preferences?.tone_preference || 'warm';
    }
  } catch (e) {
    // Fallback to default
  }
  return 'warm'; // Default fallback
};

body: JSON.stringify({ 
  message: text,
  conversationId: conversationId || null,
  timezone: getClientTimezone(),
  tonePreference: getTonePreference() // ✅ NEW: Pass tone preference
}),
```

**Also update `sendMessageWithAttachments`** (around line 820):

**Find:**
```typescript
body: JSON.stringify({
  conversationId: conversationId,
  message: caption || 'Please respond to my voice note.',
  attachments: uploadedAttachments.map(att => ({
    type: att.type,
    url: att.url || att.publicUrl
  }))
})
```

**Replace with:**
```typescript
// ✅ NEW: Get tone preference helper (reuse same function)
const getTonePreference = (): string | undefined => {
  try {
    const customizationStr = localStorage.getItem(`atlas-customization-${userId || ''}`);
    if (customizationStr) {
      const customization = JSON.parse(customizationStr);
      return customization?.preferences?.tone_preference || 'warm';
    }
  } catch (e) {
    // Fallback to default
  }
  return 'warm';
};

body: JSON.stringify({
  conversationId: conversationId,
  message: caption || 'Please respond to my voice note.',
  attachments: uploadedAttachments.map(att => ({
    type: att.type,
    url: att.url || att.publicUrl
  })),
  tonePreference: getTonePreference() // ✅ NEW: Pass tone preference
})
```

---

## 🔧 PART 4: Backend Tone Preference Integration

**File:** `backend/server.mjs`

### 4A: Extract tone preference from request

**Location:** Around line 2612-2626 (where userPreferences is fetched)

**After fetching userPreferences, add tone preference extraction:**

```javascript
// ✅ NEW: Extract tone preference from request body or user preferences
let tonePreference = null;
if (req.body?.tonePreference) {
  tonePreference = req.body.tonePreference; // Frontend override (user's current choice)
  logger.debug(`[Message] Using tone preference from request: ${tonePreference}`);
} else if (userPreferences?.tone_preference) {
  tonePreference = userPreferences.tone_preference; // From database
  logger.debug(`[Message] Using tone preference from database: ${tonePreference}`);
} else {
  tonePreference = 'warm'; // Default fallback
  logger.debug(`[Message] Using default tone preference: warm`);
}
```

### 4B: Add tone instructions to system prompt

**Location:** Around line 1096-1104 (where preferences are processed)

**Find:**
```javascript
if (preferences) {
  const parts = [];
  if (preferences.workFunction) parts.push(`Work function: ${preferences.workFunction}`);
  if (preferences.goals && preferences.goals.length > 0) parts.push(`Goals: ${preferences.goals.join(', ')}`);
  if (preferences.communicationStyle) parts.push(`Communication style: ${preferences.communicationStyle}`);
  if (parts.length > 0) {
    personalizationNote = `\n\nPERSONALIZATION:\n${parts.join('\n')}`;
  }
}
```

**Replace with:**
```javascript
if (preferences) {
  const parts = [];
  if (preferences.workFunction) parts.push(`Work function: ${preferences.workFunction}`);
  if (preferences.goals && preferences.goals.length > 0) parts.push(`Goals: ${preferences.goals.join(', ')}`);
  if (preferences.communicationStyle) parts.push(`Communication style: ${preferences.communicationStyle}`);
  if (parts.length > 0) {
    personalizationNote = `\n\nPERSONALIZATION:\n${parts.join('\n')}`;
  }
}

// ✅ NEW: Add tone preference instructions
if (tonePreference) {
  const toneInstructions = {
    warm: 'Use a warm, friendly, kind, human, and encouraging tone. Be supportive and emotionally intelligent.',
    direct: 'Use a structured, efficient, and minimal-emotion tone. Be clear and concise.',
    neutral: 'Use a balanced and factual tone. Be professional and objective.',
    creative: 'Use a metaphorical, playful, and imaginative tone. Be creative and engaging.'
  };
  
  const toneBlock = `\n\nTONE INSTRUCTIONS:\nThe user prefers the tone: "${tonePreference}".\n${toneInstructions[tonePreference] || toneInstructions.warm}\n\nMATCH THIS TONE CONSISTENTLY THROUGHOUT YOUR RESPONSE.`;
  
  if (personalizationNote) {
    personalizationNote += toneBlock;
  } else {
    personalizationNote = toneBlock;
  }
}
```

**Also pass tonePreference to streamAnthropicResponse** (around line 2949):

**Find:**
```javascript
streamAnthropicResponse(
  finalUserContent,
  selectedModel,
  res,
  userId,
  conversationHistory, 
  is_voice_call, 
  tier: effectiveTier, 
  preferences: userPreferences, 
  conversationId: finalConversationId,
  enhancedSystemPrompt,
  enhancedUserPrompt,
  timezone
);
```

**Update to pass tonePreference in preferences object:**

**Actually, better approach:** Modify the preferences object to include tone_preference before passing:

**After line 2626, add:**
```javascript
// ✅ NEW: Merge tone preference into userPreferences object
if (tonePreference && userPreferences) {
  userPreferences.tone_preference = tonePreference;
} else if (tonePreference && !userPreferences) {
  userPreferences = { tone_preference: tonePreference };
}
```

---

## 🔧 PART 5: Contextual Memory Limit (8 Messages)

**File:** `backend/server.mjs`

**Location:** Around line 1257 (where validHistory is pushed to messages)

**Find:**
```javascript
messages.push(...validHistory);
logger.debug(
  `🧠 [Memory] Added ${validHistory.length} messages to context (filtered ${
    conversationHistory.length - validHistory.length
  } empty messages)`
);
```

**Replace with:**
```javascript
// ✅ NEW: Limit to last 8 messages (prevents token bloat, improves performance)
const limitedHistory = validHistory.slice(-8);
messages.push(...limitedHistory);
logger.debug(
  `🧠 [Memory] Added ${limitedHistory.length} messages to context (filtered ${
    conversationHistory.length - validHistory.length
  } empty messages, limited to last 8)`
);
```

**Also update the DB query limit** (around line 2811):

**Find:**
```javascript
.limit(10); // Last 10 messages for context
```

**Replace with:**
```javascript
.limit(8); // ✅ NEW: Last 8 messages for context (prevents token bloat)
```

**Add context rules to system prompt** (around line 1288, in system prompt construction):

**Find where system prompt is built** (around line 1288-1300):

**Add after the system prompt base:**

```javascript
const contextRules = `

CONTEXT RULES:

You will receive a summary of recent messages from this conversation.

Use this context to stay consistent, but do NOT repeat long text.

If a past message is irrelevant, ignore it.

If the user changes topic, follow the new topic.

Keep responses focused on the current conversation thread.

`;

// Append to system prompt
const finalSystemPromptWithContext = (finalSystemPrompt || baseSystemPrompt) + contextRules;
```

**Actually, simpler:** Add context rules to `promptOrchestrator.mjs` instead (cleaner separation).

**File:** `backend/services/promptOrchestrator.mjs`

**Location:** After the new FORMAT RULES section (after line 50 or so)

**Add:**

```javascript
----------------------------------

🧠 CONTEXT RULES

----------------------------------

When you receive conversation history:

• Use context to stay consistent with the conversation thread
• Do NOT repeat long text from previous messages
• If a past message is irrelevant, ignore it
• If the user changes topic, follow the new topic
• Keep responses focused on the current conversation

This ensures you remember context without becoming verbose or repetitive.

----------------------------------
```

---

## 🔧 PART 6: Sync Tone Preference to Database

**File:** `src/hooks/useCustomization.ts`

**Location:** In `saveCustomization` function (around line 380-467)

**The existing save logic should already handle `preferences.tone_preference`** since it saves the entire customization object.

**Verify:** The `saveCustomization` function saves to both localStorage and database. Since we added `tone_preference` to the preferences object, it will be saved automatically.

**However, we need to ensure backend reads it from `profiles.preferences`:**

**File:** `backend/server.mjs`

**Location:** Around line 2616-2622 (where preferences are fetched)

**The existing code already reads `profile.preferences`**, so `tone_preference` will be available if saved.

**But we need to ensure the backend can read it:**

**Verify the fetch includes tone_preference** — the existing code should work since it fetches the entire `preferences` object.

---

## 📌 Verification Checklist

After implementing:

1. ✅ System prompt has new FORMAT RULES section
2. ✅ System prompt has CONTEXT RULES section  
3. ✅ ControlCenter has tone preference UI in Preferences tab
4. ✅ useCustomization type includes tone_preference
5. ✅ chatService passes tonePreference to backend
6. ✅ Backend extracts tonePreference from request
7. ✅ Backend adds tone instructions to system prompt
8. ✅ Conversation history limited to 8 messages (both DB query and after filtering)
9. ✅ Voice calls still use 5 messages (unchanged)

---

## 🧪 Testing

1. **Test tone preference:**
   - Open ControlCenter → Preferences tab
   - Select different tone options
   - Send a message
   - Verify Atlas responds in selected tone

2. **Test memory limit:**
   - Send 10+ messages in a conversation
   - Verify only last 8 are used (check backend logs)

3. **Test paragraph formatting:**
   - Send any message
   - Verify response has clean paragraphs, no emoji at start

---

## 📜 Summary of Changes

- ✅ Enhanced system prompt with FORMAT RULES and CONTEXT RULES
- ✅ Added tone_preference to useCustomization interface
- ✅ Added tone preference UI to ControlCenter Preferences tab
- ✅ Updated chatService to pass tonePreference to backend
- ✅ Backend extracts and uses tone preference in system prompt
- ✅ Limited conversation history to 8 messages (DB query + after filtering)
- ✅ All changes are backward compatible (defaults to 'warm' tone)

---

**End of Cursor Prompt**

