/**
 * Mobile-compatible UUID generator
 * Falls back to custom implementation when crypto.randomUUID is not available
 */

export function generateUUID(): string {
  // Try to use the native crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      console.warn('[UUID] crypto.randomUUID failed, using fallback:', error);
    }
  }

  // Fallback for mobile browsers and older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Export as default for convenience
export default generateUUID;
