// Force reset the entire Dexie database
export const forceResetDB = async () => {
  try {
    console.log('[FORCE RESET] Starting complete database reset...');
    
    // Clear all localStorage
    localStorage.clear();
    
    // Clear all sessionStorage
    sessionStorage.clear();
    
    // Delete IndexedDB databases
    if ('indexedDB' in window) {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name && (db.name.includes('Atlas') || db.name.includes('dexie'))) {
          console.log(`[FORCE RESET] Deleting database: ${db.name}`);
          const deleteReq = indexedDB.deleteDatabase(db.name);
          await new Promise((resolve, reject) => {
            deleteReq.onsuccess = () => resolve(true);
            deleteReq.onerror = () => reject(deleteReq.error);
            deleteReq.onblocked = () => {
              console.warn(`[FORCE RESET] Database ${db.name} deletion blocked`);
              resolve(true);
            };
          });
        }
      }
    }
    
    // Clear any cached data
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        if (cacheName.includes('atlas') || cacheName.includes('dexie')) {
          await caches.delete(cacheName);
        }
      }
    }
    
    console.log('[FORCE RESET] Database reset complete');
    return true;
  } catch (error) {
    console.error('[FORCE RESET] Failed to reset database:', error);
    return false;
  }
};
