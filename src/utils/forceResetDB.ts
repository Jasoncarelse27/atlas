// Force reset the entire Dexie database
export const forceResetDB = async () => {
  try {
    
    // Clear all localStorage
    localStorage.clear();
    
    // Clear all sessionStorage
    sessionStorage.clear();
    
    // Delete IndexedDB databases
    if ('indexedDB' in window) {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name && (db.name.includes('Atlas') || db.name.includes('dexie'))) {
          const deleteReq = indexedDB.deleteDatabase(db.name);
          await new Promise((resolve, reject) => {
            deleteReq.onsuccess = () => resolve(true);
            deleteReq.onerror = () => reject(deleteReq.error);
            deleteReq.onblocked = () => {
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
    
    return true;
  } catch (error) {
    return false;
  }
};
