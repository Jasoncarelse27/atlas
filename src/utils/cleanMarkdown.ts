/**
 * Clean markdown and fix spacing in Atlas assistant responses
 * PRESERVES markdown structure for ReactMarkdown to parse
 * Only fixes spacing issues and removes stage directions
 */
export function cleanMarkdown(text: string): string {
  if (!text) return "";

  return text
    // ✅ CRITICAL: DO NOT remove markdown headers (##, ###) - let ReactMarkdown handle them
    // ✅ CRITICAL: DO NOT remove markdown formatting - ReactMarkdown needs it
    
    // Remove stage directions (text in asterisks or brackets) - these are not markdown
    .replace(/\*[^*]+\*/g, "") // Remove *stage directions*
    .replace(/\[[^\]]+\]/g, "") // Remove [stage directions]
    
    // Fix glued words: WhichFeels → Which Feels, Yourexpression → Your expression
    // Only fix if it's clearly two words (lowercase followed by uppercase)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    
    // Fix glued words with numbers: Even10 → Even 10
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    
    // Fix broken words: "Signif I cance" → "Significance" (if pattern detected)
    // This is tricky - we'll be conservative and only fix obvious cases
    // Pattern: Capital word + space + "I" + lowercase word (likely a split word)
    .replace(/([A-Z][a-z]{3,})\s+I\s+([a-z]{3,})/g, (match, p1, p2) => {
      // Check if combining makes sense (e.g., "Signif" + "I" + "cance" → "Significance")
      const combined = p1 + p2;
      // Common word endings that might be split this way
      if (combined.endsWith('ance') || combined.endsWith('ence') || combined.endsWith('tion') || combined.endsWith('sion') || 
          combined.endsWith('ing') || combined.endsWith('ed') || combined.endsWith('ly')) {
        return combined;
      }
      return match; // Keep original if unsure
    })
    
    // Normalize multiple spaces to single space (preserve single spaces)
    .replace(/\s{2,}/g, " ")
    
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
 * Fix spacing issues while preserving markdown structure
 * Used BEFORE ReactMarkdown parsing to fix glued words and broken spacing
 * Does NOT remove markdown - ReactMarkdown needs it
 */
export function fixSpacingOnly(text: string): string {
  // ✅ SAFETY: Handle null/undefined/empty strings
  if (!text || typeof text !== 'string') return "";
  
  return text
    // Remove stage directions (text in asterisks or brackets) - these are not markdown
    .replace(/\*[^*]+\*/g, "") // Remove *stage directions*
    .replace(/\[[^\]]+\]/g, "") // Remove [stage directions]
    
    // Fix glued words: WhichFeels → Which Feels, Yourexpression → Your expression
    // Only fix if it's clearly two words (lowercase followed by uppercase)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    
    // Fix glued words with numbers: Even10 → Even 10
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    
    // Fix broken words: "Signif I cance" → "Significance" (if pattern detected)
    // Pattern: Capital word + space + "I" + lowercase word (likely a split word)
    .replace(/([A-Z][a-z]{3,})\s+I\s+([a-z]{3,})/g, (match, p1, p2) => {
      const combined = p1 + p2;
      // Common word endings that might be split this way
      if (combined.endsWith('ance') || combined.endsWith('ence') || combined.endsWith('tion') || combined.endsWith('sion') || 
          combined.endsWith('ing') || combined.endsWith('ed') || combined.endsWith('ly')) {
        return combined;
      }
      return match; // Keep original if unsure
    })
    
    // Normalize multiple spaces to single space (preserve single spaces)
    .replace(/\s{2,}/g, " ")
    
    // Trim leading/trailing whitespace
    .trim();
}

/**
 * Combined cleaning function for assistant messages
 * Applies all formatting fixes in correct order
 * NOTE: This removes markdown - use fixSpacingOnly() if you need to preserve markdown for ReactMarkdown
 */
export function cleanAssistantMessage(text: string): string {
  if (!text) return "";
  
  // Step 1: Remove leading emoji
  let cleaned = removeLeadingEmoji(text);
  
  // Step 2: Clean markdown and fix spacing (removes markdown structure)
  cleaned = cleanMarkdown(cleaned);
  
  return cleaned;
}

