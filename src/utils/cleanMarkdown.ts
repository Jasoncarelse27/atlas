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
  
  // ✅ BEST PRACTICE: Exception list for camelCase identifiers (don't split these)
  const camelCaseExceptions = [
    'JavaScript', 'TypeScript', 'GitHub', 'OpenAI', 'ChatGPT', 'DeepSeek',
    'ReactNative', 'NodeJS', 'NextJS', 'FastAPI', 'MongoDB', 'PostgreSQL',
    'YouTube', 'LinkedIn', 'TikTok', 'WhatsApp', 'FaceBook', 'MailerLite',
    'iPhone', 'iPad', 'macOS', 'iOS', 'APIs', 'URLs', 'HTML', 'CSS'
  ];
  
  // Step 7: Fix glued words - AGGRESSIVE patterns (handles Tabmanagement, Performancetuning, workflowdesign)
  // Pattern 1: Universal Capital→lowercase boundary detector (most effective)
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, (match, p1, p2) => {
    // Check if this is a known camelCase exception
    const beforeMatch = cleaned.substring(0, cleaned.indexOf(match) + 1);
    const afterMatch = cleaned.substring(cleaned.indexOf(match));
    const fullWord = beforeMatch.split(/\s/).pop() + afterMatch.split(/\s/)[0];
    if (camelCaseExceptions.some(exc => fullWord?.includes(exc))) {
      return match; // Keep camelCase exceptions intact
    }
    return `${p1} ${p2}`;
  });
  
  // Pattern 2: word ending with lowercase→uppercase→lowercase (handles "Massappears", "Yourcommitment")
  cleaned = cleaned.replace(/([A-Z][a-z]+)([A-Z][a-z])/g, "$1 $2");
  
  // Pattern 3: all lowercase glued words (handles "pleaseclarify", "offersseveral", "workflowdesign")
  // ✅ IMPROVED: More aggressive with longer common word lists
  cleaned = cleaned.replace(/([a-z]{3,})([a-z]{3,})/g, (match, p1, p2) => {
    if (p1.length >= 3 && p2.length >= 3) {
      // Extended common word endings
      const commonEnds = [
        'ly', 'ed', 'ing', 'er', 'al', 'ic', 'ous', 'ful', 'ive', 'ant', 'ent',
        'se', 're', 'le', 'ce', 'ty', 'ry', 'cy', 'ny', 'gy', 'py', 'ay', 'ey',
        'on', 'en', 'an', 'un', 'or', 'ar', 'ir', 'ur', 'at', 'et', 'it', 'ut',
        'ab', 'ob', 'ub', 'ib', 'eb', 'ck', 'nk', 'sk', 'lk', 'rk', 'wk',
        'ss', 'ff', 'll', 'nn', 'tt', 'pp', 'rr', 'mm', 'dd', 'gg', 'zz',
        'ment', 'ness', 'tion', 'sion', 'ance', 'ence', 'able', 'ible'
      ];
      // Extended common word starts  
      const commonStarts = [
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
        'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
        'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
        'did', 'let', 'put', 'say', 'she', 'too', 'use', 'tab', 'per', 'man',
        'des', 'tun', 'flow', 'work', 'plan', 'app', 'off', 'sev', 'clar',
        'bring', 'think', 'about', 'with', 'from', 'this', 'that', 'have',
        'been', 'were', 'will', 'would', 'could', 'should', 'there', 'their',
        'what', 'which', 'where', 'when', 'your', 'some', 'very', 'just',
        'management', 'performance', 'tuning', 'design', 'workflow'
      ];
      if (commonEnds.some(end => p1.endsWith(end)) || commonStarts.some(start => p2.startsWith(start))) {
        return `${p1} ${p2}`;
      }
      // ✅ NEW: If first part ends with consonant and second starts with vowel, likely split
      if (/[bcdfghjklmnpqrstvwxyz]$/.test(p1) && /^[aeiou]/.test(p2)) {
        // Probably NOT a split - keep as is
      } else if (/[bcdfghjklmnpqrstvwxyz]$/.test(p1) && /^[bcdfghjklmnpqrstvwxyz]/.test(p2)) {
        // Consonant-consonant boundary often indicates word boundary
        return `${p1} ${p2}`;
      }
    }
    return match;
  });
  
  // Fix glued words with numbers: Even10 → Even 10
  cleaned = cleaned.replace(/([a-z])([0-9])/g, "$1 $2");
  cleaned = cleaned.replace(/([0-9])([a-z])/g, "$1 $2");
  
  // Step 8: Fix broken words - COMPREHENSIVE patterns
  // ✅ IMPROVED: Handles "bring ing", "perfor mance", "plan ning", "func tion"
  
  // Pattern 1: "Signif I cance" style (Capital + I + lowercase)
  cleaned = cleaned.replace(/([A-Z][a-z]{2,})\s+I\s+([a-z]{2,})/g, (match, p1, p2) => {
    const combined = p1.toLowerCase() + p2;
    const validEndings = ['ance', 'ence', 'tion', 'sion', 'ing', 'ed', 'ly', 'ant', 'ent', 'ive', 'ous', 'ful', 'ment', 'ness'];
    if (validEndings.some(end => combined.endsWith(end))) {
      return p1 + p2; // Merge without 'I'
    }
    return match;
  });
  
  // Pattern 2: "bring ing" style (word + space + common suffix)
  // Handles: bring ing, perform ance, plan ning, func tion, think ing
  cleaned = cleaned.replace(/(\w{3,})\s+(ing|ed|ly|tion|sion|ance|ence|ment|ness|ive|ous|ful|able|ible|er|est|al|ity)\b/gi, (_match, p1, p2) => {
    // Check if combining makes a likely English word
    const combined = p1 + p2;
    // If the first part ends with a letter that commonly precedes the suffix, merge
    const lastChar = p1[p1.length - 1].toLowerCase();
    const suffix = p2.toLowerCase();
    
    // Common patterns that should be merged
    if (suffix === 'ing' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'ed' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'ly' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'tion' && /[aeiou]/.test(lastChar)) return combined;
    if (suffix === 'ance' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'ence' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'ment' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'ness' && /[a-z]/.test(lastChar)) return combined;
    
    return combined; // Default: merge
  });
  
  // Pattern 3: Short fragment + space + short fragment (likely one word split)
  // Handles: "per for mance" → "performance", "sig nif icance"
  cleaned = cleaned.replace(/\b([a-z]{2,5})\s+([a-z]{2,5})\s+([a-z]{2,6})\b/gi, (match, p1, p2, p3) => {
    const combined = p1 + p2 + p3;
    // Only merge if total length is reasonable for a word (8-15 chars)
    if (combined.length >= 8 && combined.length <= 15) {
      // Check if it ends with a common word ending
      const validEndings = ['ance', 'ence', 'tion', 'sion', 'ment', 'ness', 'ive', 'ous', 'ful', 'able', 'ible'];
      if (validEndings.some(end => combined.toLowerCase().endsWith(end))) {
        return combined;
      }
    }
    return match;
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
  
  // ✅ BEST PRACTICE: Exception list for camelCase identifiers (don't split these)
  const camelCaseExceptions = [
    'JavaScript', 'TypeScript', 'GitHub', 'OpenAI', 'ChatGPT', 'DeepSeek',
    'ReactNative', 'NodeJS', 'NextJS', 'FastAPI', 'MongoDB', 'PostgreSQL',
    'YouTube', 'LinkedIn', 'TikTok', 'WhatsApp', 'FaceBook', 'MailerLite',
    'iPhone', 'iPad', 'macOS', 'iOS', 'APIs', 'URLs', 'HTML', 'CSS'
  ];
  
  // Step 7: Fix glued words - AGGRESSIVE patterns (handles Tabmanagement, Performancetuning, workflowdesign)
  // Pattern 1: Universal Capital→lowercase boundary detector (most effective)
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, (match, p1, p2) => {
    // Check if this is a known camelCase exception
    const beforeMatch = cleaned.substring(0, cleaned.indexOf(match) + 1);
    const afterMatch = cleaned.substring(cleaned.indexOf(match));
    const fullWord = beforeMatch.split(/\s/).pop() + afterMatch.split(/\s/)[0];
    if (camelCaseExceptions.some(exc => fullWord?.includes(exc))) {
      return match; // Keep camelCase exceptions intact
    }
    return `${p1} ${p2}`;
  });
  
  // Pattern 2: word ending with lowercase→uppercase→lowercase (handles "Massappears", "Yourcommitment")
  cleaned = cleaned.replace(/([A-Z][a-z]+)([A-Z][a-z])/g, "$1 $2");
  
  // Pattern 3: all lowercase glued words (handles "pleaseclarify", "offersseveral", "workflowdesign")
  // ✅ IMPROVED: More aggressive with longer common word lists
  cleaned = cleaned.replace(/([a-z]{3,})([a-z]{3,})/g, (match, p1, p2) => {
    if (p1.length >= 3 && p2.length >= 3) {
      // Extended common word endings
      const commonEnds = [
        'ly', 'ed', 'ing', 'er', 'al', 'ic', 'ous', 'ful', 'ive', 'ant', 'ent',
        'se', 're', 'le', 'ce', 'ty', 'ry', 'cy', 'ny', 'gy', 'py', 'ay', 'ey',
        'on', 'en', 'an', 'un', 'or', 'ar', 'ir', 'ur', 'at', 'et', 'it', 'ut',
        'ab', 'ob', 'ub', 'ib', 'eb', 'ck', 'nk', 'sk', 'lk', 'rk', 'wk',
        'ss', 'ff', 'll', 'nn', 'tt', 'pp', 'rr', 'mm', 'dd', 'gg', 'zz',
        'ment', 'ness', 'tion', 'sion', 'ance', 'ence', 'able', 'ible'
      ];
      // Extended common word starts  
      const commonStarts = [
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
        'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
        'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
        'did', 'let', 'put', 'say', 'she', 'too', 'use', 'tab', 'per', 'man',
        'des', 'tun', 'flow', 'work', 'plan', 'app', 'off', 'sev', 'clar',
        'bring', 'think', 'about', 'with', 'from', 'this', 'that', 'have',
        'been', 'were', 'will', 'would', 'could', 'should', 'there', 'their',
        'what', 'which', 'where', 'when', 'your', 'some', 'very', 'just',
        'management', 'performance', 'tuning', 'design', 'workflow'
      ];
      if (commonEnds.some(end => p1.endsWith(end)) || commonStarts.some(start => p2.startsWith(start))) {
        return `${p1} ${p2}`;
      }
      // ✅ NEW: If first part ends with consonant and second starts with vowel, likely split
      if (/[bcdfghjklmnpqrstvwxyz]$/.test(p1) && /^[aeiou]/.test(p2)) {
        // Probably NOT a split - keep as is
      } else if (/[bcdfghjklmnpqrstvwxyz]$/.test(p1) && /^[bcdfghjklmnpqrstvwxyz]/.test(p2)) {
        // Consonant-consonant boundary often indicates word boundary
        return `${p1} ${p2}`;
      }
    }
    return match;
  });
  
  // Fix glued words with numbers: Even10 → Even 10
  cleaned = cleaned.replace(/([a-z])([0-9])/g, "$1 $2");
  cleaned = cleaned.replace(/([0-9])([a-z])/g, "$1 $2");
  
  // Step 8: Fix broken words - COMPREHENSIVE patterns
  // ✅ IMPROVED: Handles "bring ing", "perfor mance", "plan ning", "func tion"
  
  // Pattern 1: "Signif I cance" style (Capital + I + lowercase)
  cleaned = cleaned.replace(/([A-Z][a-z]{2,})\s+I\s+([a-z]{2,})/g, (match, p1, p2) => {
    const combined = p1.toLowerCase() + p2;
    const validEndings = ['ance', 'ence', 'tion', 'sion', 'ing', 'ed', 'ly', 'ant', 'ent', 'ive', 'ous', 'ful', 'ment', 'ness'];
    if (validEndings.some(end => combined.endsWith(end))) {
      return p1 + p2; // Merge without 'I'
    }
    return match;
  });
  
  // Pattern 2: "bring ing" style (word + space + common suffix)
  // Handles: bring ing, perform ance, plan ning, func tion, think ing
  cleaned = cleaned.replace(/(\w{3,})\s+(ing|ed|ly|tion|sion|ance|ence|ment|ness|ive|ous|ful|able|ible|er|est|al|ity)\b/gi, (_match, p1, p2) => {
    // Check if combining makes a likely English word
    const combined = p1 + p2;
    // If the first part ends with a letter that commonly precedes the suffix, merge
    const lastChar = p1[p1.length - 1].toLowerCase();
    const suffix = p2.toLowerCase();
    
    // Common patterns that should be merged
    if (suffix === 'ing' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'ed' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'ly' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'tion' && /[aeiou]/.test(lastChar)) return combined;
    if (suffix === 'ance' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'ence' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'ment' && /[a-z]/.test(lastChar)) return combined;
    if (suffix === 'ness' && /[a-z]/.test(lastChar)) return combined;
    
    return combined; // Default: merge
  });
  
  // Pattern 3: Short fragment + space + short fragment (likely one word split)
  // Handles: "per for mance" → "performance", "sig nif icance"
  cleaned = cleaned.replace(/\b([a-z]{2,5})\s+([a-z]{2,5})\s+([a-z]{2,6})\b/gi, (match, p1, p2, p3) => {
    const combined = p1 + p2 + p3;
    // Only merge if total length is reasonable for a word (8-15 chars)
    if (combined.length >= 8 && combined.length <= 15) {
      // Check if it ends with a common word ending
      const validEndings = ['ance', 'ence', 'tion', 'sion', 'ment', 'ness', 'ive', 'ous', 'ful', 'able', 'ible'];
      if (validEndings.some(end => combined.toLowerCase().endsWith(end))) {
        return combined;
      }
    }
    return match;
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

