/**
 * Clean markdown and fix spacing in Atlas assistant responses
 * PRESERVES markdown structure for ReactMarkdown to parse
 * Only fixes spacing issues and removes stage directions
 */
export function cleanMarkdown(text: string): string {
  if (!text) return "";

  // ✅ SAFARI-COMPATIBLE: Protect markdown bold first (no lookbehinds)
  // Step 1: Protect markdown bold **text** with placeholders
  let cleaned = text.replace(/\*\*([^*]+)\*\*/g, "___BOLD_START___$1___BOLD_END___");
  
  // Step 2: Remove stage directions *text* (single asterisks only)
  cleaned = cleaned.replace(/\*([^*\n]+)\*/g, "");
  
  // Step 3: Remove square bracket stage directions [text]
  cleaned = cleaned.replace(/\[[^\]]+\]/g, "");
  
  // Step 4: Restore markdown bold
  cleaned = cleaned.replace(/___BOLD_START___([^_]+)___BOLD_END___/g, "**$1**");
  
  // Step 5: Fix markdown headers missing space: ##Header → ## Header
  cleaned = cleaned.replace(/(##+)([A-Za-z])/g, "$1 $2");
  
  // Step 6: Clean up orphaned asterisks (leftover ** from partial markdown)
  cleaned = cleaned.replace(/\s*\*\*\s*$/gm, "");   // Remove ** at end of lines
  cleaned = cleaned.replace(/^\s*\*\*\s*/gm, "");   // Remove ** at start of lines
  cleaned = cleaned.replace(/\s+\*\*\s+/g, " ");    // Remove ** surrounded by spaces
  cleaned = cleaned.replace(/\*\*\s*$/g, "");       // Remove trailing **
  
  // Step 7: Fix glued words: WhichFeels → Which Feels, Yourexpression → Your expression, Massappears → Mass appears
  // Pattern 1: lowercase→uppercase→lowercase (most common)
  cleaned = cleaned.replace(/([a-z])([A-Z][a-z])/g, "$1 $2");
  // Pattern 2: word ending with lowercase→uppercase→lowercase (handles "Massappears", "Yourcommitment")
  cleaned = cleaned.replace(/([A-Z][a-z]+)([A-Z][a-z])/g, "$1 $2");
  // Pattern 3: all lowercase glued words (handles "pleaseclarify", "offersseveral")
  cleaned = cleaned.replace(/([a-z]{3,})([a-z]{3,})/g, (match, p1, p2) => {
    // Only fix if both parts look like words (not single letters or very short)
    if (p1.length >= 3 && p2.length >= 3) {
      // Check if p1 ends with common word endings and p2 starts with common word starts
      const commonEnds = ['ly', 'ed', 'ing', 'er', 'al', 'ic', 'ous', 'ful', 'ive', 'ant', 'ent', 'se', 're', 'le', 'ce'];
      const commonStarts = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'let', 'put', 'say', 'she', 'too', 'use', 'appears', 'offers', 'several', 'clarify'];
      if (commonEnds.some(end => p1.endsWith(end)) || commonStarts.some(start => p2.startsWith(start))) {
        return `${p1} ${p2}`;
      }
    }
    return match;
  });
  
  // Fix glued words with numbers: Even10 → Even 10
  cleaned = cleaned.replace(/([a-z])([0-9])/g, "$1 $2");
  cleaned = cleaned.replace(/([0-9])([a-z])/g, "$1 $2");
  
  // Step 8: Fix broken words: "Signif I cance" → "Significance" (if pattern detected)
  cleaned = cleaned.replace(/([A-Z][a-z]{3,})\s+I\s+([a-z]{3,})/g, (match, p1, p2) => {
    const combined = p1 + p2;
    // Common word endings that might be split this way
    if (combined.endsWith('ance') || combined.endsWith('ence') || combined.endsWith('tion') || combined.endsWith('sion') || 
        combined.endsWith('ing') || combined.endsWith('ed') || combined.endsWith('ly') ||
        combined.endsWith('ant') || combined.endsWith('ent') || combined.endsWith('ive') ||
        combined.endsWith('ous') || combined.endsWith('ful')) {
      return combined.charAt(0).toUpperCase() + combined.slice(1);
    }
    return match; // Keep original if unsure
  });
  
  // Step 9: Normalize spacing
  cleaned = cleaned.replace(/\s{2,}/g, " ");  // Multiple spaces to single
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n"); // Multiple newlines to double
  
  // Step 10: Trim leading/trailing whitespace
  return cleaned.trim();
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
  
  // ✅ SAFARI-COMPATIBLE: Protect markdown bold first (no lookbehinds)
  // Step 1: Protect markdown bold **text** with placeholders
  let cleaned = text.replace(/\*\*([^*]+)\*\*/g, "___BOLD_START___$1___BOLD_END___");
  
  // Step 2: Remove stage directions *text* (single asterisks only)
  cleaned = cleaned.replace(/\*([^*\n]+)\*/g, "");
  
  // Step 3: Remove square bracket stage directions [text]
  cleaned = cleaned.replace(/\[[^\]]+\]/g, "");
  
  // Step 4: Restore markdown bold
  cleaned = cleaned.replace(/___BOLD_START___([^_]+)___BOLD_END___/g, "**$1**");
  
  // Step 5: Fix markdown headers missing space: ##Header → ## Header
  cleaned = cleaned.replace(/(##+)([A-Za-z])/g, "$1 $2");
  
  // Step 6: Clean up orphaned asterisks (leftover ** from partial markdown)
  cleaned = cleaned.replace(/\s*\*\*\s*$/gm, "");   // Remove ** at end of lines
  cleaned = cleaned.replace(/^\s*\*\*\s*/gm, "");   // Remove ** at start of lines
  cleaned = cleaned.replace(/\s+\*\*\s+/g, " ");    // Remove ** surrounded by spaces
  cleaned = cleaned.replace(/\*\*\s*$/g, "");       // Remove trailing **
  
  // Step 7: Fix glued words: WhichFeels → Which Feels, Yourexpression → Your expression, Massappears → Mass appears
  // Pattern 1: lowercase→uppercase→lowercase (most common)
  cleaned = cleaned.replace(/([a-z])([A-Z][a-z])/g, "$1 $2");
  // Pattern 2: word ending with lowercase→uppercase→lowercase (handles "Massappears", "Yourcommitment")
  cleaned = cleaned.replace(/([A-Z][a-z]+)([A-Z][a-z])/g, "$1 $2");
  // Pattern 3: all lowercase glued words (handles "pleaseclarify", "offersseveral")
  cleaned = cleaned.replace(/([a-z]{3,})([a-z]{3,})/g, (match, p1, p2) => {
    // Only fix if both parts look like words (not single letters or very short)
    if (p1.length >= 3 && p2.length >= 3) {
      // Check if p1 ends with common word endings and p2 starts with common word starts
      const commonEnds = ['ly', 'ed', 'ing', 'er', 'al', 'ic', 'ous', 'ful', 'ive', 'ant', 'ent', 'se', 're', 'le', 'ce'];
      const commonStarts = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'let', 'put', 'say', 'she', 'too', 'use', 'appears', 'offers', 'several', 'clarify'];
      if (commonEnds.some(end => p1.endsWith(end)) || commonStarts.some(start => p2.startsWith(start))) {
        return `${p1} ${p2}`;
      }
    }
    return match;
  });
  
  // Fix glued words with numbers: Even10 → Even 10
  cleaned = cleaned.replace(/([a-z])([0-9])/g, "$1 $2");
  cleaned = cleaned.replace(/([0-9])([a-z])/g, "$1 $2");
  
  // Step 8: Fix broken words: "Signif I cance" → "Significance" (if pattern detected)
  // Pattern: Capital word + space + "I" + lowercase word (likely a split word)
  cleaned = cleaned.replace(/([A-Z][a-z]{3,})\s+I\s+([a-z]{3,})/g, (match, p1, p2) => {
    const combined = p1 + p2;
    // Common word endings that might be split this way
    if (combined.endsWith('ance') || combined.endsWith('ence') || combined.endsWith('tion') || combined.endsWith('sion') || 
        combined.endsWith('ing') || combined.endsWith('ed') || combined.endsWith('ly') ||
        combined.endsWith('ant') || combined.endsWith('ent') || combined.endsWith('ive') ||
        combined.endsWith('ous') || combined.endsWith('ful')) {
      return combined.charAt(0).toUpperCase() + combined.slice(1);
    }
    return match; // Keep original if unsure
  });
  
  // Step 9: Normalize spacing
  cleaned = cleaned.replace(/\s{2,}/g, " ");  // Multiple spaces to single
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n"); // Multiple newlines to double
  
  // Step 10: Trim leading/trailing whitespace
  return cleaned.trim();
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

