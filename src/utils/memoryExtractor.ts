/**
 * Memory Extraction Utility
 * Simple, safe name and context extraction from conversations
 */

export interface ExtractedMemory {
  name?: string;
  context?: string;
  preferences?: string[];
}

/**
 * Extract name from user messages
 * Simple patterns: "My name is...", "I'm...", "Call me..."
 */
export function extractNameFromMessage(message: string): string | null {
  const patterns = [
    // More specific patterns to avoid capturing too much
    /(?:my name is|i'm|call me|i am)\s+([a-zA-Z]{2,20})(?:\s|$|,|\.|and)/i,
    /(?:name|called)\s+([a-zA-Z]{2,20})(?:\s|$|,|\.|and)/i,
    /^([a-zA-Z]{2,20})(?:\s+here|$)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Basic validation - reasonable name length and characters
      if (name.length >= 2 && name.length <= 20 && /^[a-zA-Z]+$/.test(name)) {
        return name;
      }
    }
  }

  return null;
}

/**
 * Extract context and preferences from conversations
 * Looks for personal details, interests, and preferences
 */
export function extractContextFromMessage(message: string): string | null {
  const contextPatterns = [
    // Better patterns to capture interests and preferences
    /(?:i like|i love|i enjoy|i'm into|i'm interested in)\s+([^.!?]{5,100})/i,
    /(?:i work|i'm a|i do)\s+([^.!?]{5,100})/i,
    /(?:i live|i'm from|i'm based)\s+([^.!?]{3,50})/i,
    /(?:my favorite|i prefer|i usually)\s+([^.!?]{5,100})/i,
    // Additional pattern for "and I love X" constructions
    /(?:and i love|and i like|and i enjoy)\s+([^.!?]{5,100})/i
  ];

  for (const pattern of contextPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const context = match[1].trim();
      if (context.length >= 3 && context.length <= 200) {
        return context;
      }
    }
  }

  return null;
}

/**
 * Main extraction function
 * Combines name and context extraction
 */
export function extractMemoryFromMessage(message: string): ExtractedMemory {
  const name = extractNameFromMessage(message);
  const context = extractContextFromMessage(message);
  
  const memory: ExtractedMemory = {};
  
  if (name) memory.name = name;
  if (context) memory.context = context;
  
  return memory;
}

/**
 * Merge new memory with existing memory
 * Preserves existing data, adds new information
 */
export function mergeMemory(existing: any, newMemory: ExtractedMemory): any {
  const merged = { ...existing };
  
  // Add name if found and not already set
  if (newMemory.name && !merged.name) {
    merged.name = newMemory.name;
  }
  
  // Add context if found (be selective to avoid over-accumulation)
  if (newMemory.context) {
    const existingContext = merged.context || '';
    
    // Only add if it's not already mentioned (case-insensitive)
    const contextLower = newMemory.context.toLowerCase();
    const existingContextLower = existingContext.toLowerCase();
    
    if (!existingContextLower.includes(contextLower)) {
      merged.context = existingContext 
        ? `${existingContext}; ${newMemory.context}`
        : newMemory.context;
    }
  }
  
  // Update timestamp
  merged.last_updated = new Date().toISOString();
  
  return merged;
}
