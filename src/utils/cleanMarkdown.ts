/**
 * Minimal text cleaner — DO NOT modify model output.
 * Only collapse multiple spaces.
 * 
 * ✅ FIXED: All aggressive regex patterns removed.
 * The backend sends clean text, frontend just displays it.
 */

export function cleanMarkdown(text: string): string {
  if (!text) return "";
  return text.replace(/\s{2,}/g, " ");
}

export function removeLeadingEmoji(text: string): string {
  if (!text) return "";
  return text; // No emoji removal - preserve model output
}

export function fixSpacingOnly(text: string): string {
  if (!text) return "";
  return text.replace(/\s{2,}/g, " ");
}

export function cleanAssistantMessage(text: string): string {
  if (!text) return "";
  return text.replace(/\s{2,}/g, " ");
}
