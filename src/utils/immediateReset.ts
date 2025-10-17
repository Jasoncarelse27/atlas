// Immediate database reset - call this right now
import { preserveLocalStorage } from './preserveLocalStorage';
import { logger } from '../lib/logger';

export const immediateReset = async () => {
  logger.debug('🚨 IMMEDIATE RESET: Forcing complete database deletion...');
  
  try {
    // Delete IndexedDB databases
    const deleteReq = indexedDB.deleteDatabase('AtlasDB');
    
    await new Promise((resolve) => {
      deleteReq.onsuccess = () => {
        logger.debug('✅ AtlasDB deleted');
        resolve(true);
      };
      deleteReq.onerror = () => {
        resolve(true); // Continue anyway
      };
      deleteReq.onblocked = () => {
        resolve(true);
      };
    });
    
    // Clear storage while preserving Supabase keys
    preserveLocalStorage();
    
    // Delete only non-Supabase localStorage entries
    Object.keys(localStorage)
      .filter(key => !key.startsWith('sb-'))
      .forEach(key => localStorage.removeItem(key));
    
    // Clear sessionStorage completely
    sessionStorage.clear();
    
    // Clear caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    }
    
    logger.debug('✅ IMMEDIATE RESET COMPLETE! Reloading page...');
    window.location.reload();
    
  } catch (error) {
    window.location.reload();
  }
};

// Make it available globally
if (typeof window !== 'undefined') {
  (window as any).immediateReset = immediateReset;
  logger.debug('🚨 IMMEDIATE RESET AVAILABLE: Run immediateReset() in console');
}
