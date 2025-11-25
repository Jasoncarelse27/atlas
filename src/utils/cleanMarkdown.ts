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
    .replace(/^[#>-]+\s*/gm, "")
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

