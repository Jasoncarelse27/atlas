import { logger } from '../lib/logger';

// Emergency database reset - call this immediately
export const emergencyReset = async () => {
  logger.debug('🚨 EMERGENCY RESET: Starting immediate database reset...');
  
  try {
    // Clear all storage immediately
    localStorage.clear();
    sessionStorage.clear();
    
    // Delete all IndexedDB databases
    if ('indexedDB' in window) {
      const databases = await indexedDB.databases();
      
      for (const db of databases) {
        if (db.name) {
          const deleteReq = indexedDB.deleteDatabase(db.name);
          await new Promise((resolve) => {
            deleteReq.onsuccess = () => {
              logger.debug(`✅ Deleted ${db.name}`);
              resolve(true);
            };
            deleteReq.onerror = () => {
              resolve(true); // Continue anyway
            };
            deleteReq.onblocked = () => {
              resolve(true); // Continue anyway
            };
          });
        }
      }
    }
    
    // Clear caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    }
    
    logger.debug('✅ EMERGENCY RESET COMPLETE! Reloading page...');
    // Force reload immediately
    window.location.reload();
    
  } catch (error) {
    // Force reload anyway
    window.location.reload();
  }
};

// Make it available globally for immediate console access
if (typeof window !== 'undefined') {
  (window as any).emergencyReset = emergencyReset;
  logger.debug('🚨 Emergency reset available: Run emergencyReset() in console');
}
