// Manual database reset utility - call this from browser console if needed
export const manualResetDB = async () => {
  console.log('🔄 Starting manual database reset...');
  
  try {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Delete all IndexedDB databases
    if ('indexedDB' in window) {
      const databases = await indexedDB.databases();
      console.log('Found databases:', databases);
      
      for (const db of databases) {
        if (db.name) {
          console.log(`Deleting database: ${db.name}`);
          const deleteReq = indexedDB.deleteDatabase(db.name);
          await new Promise((resolve, reject) => {
            deleteReq.onsuccess = () => {
              console.log(`✅ Deleted ${db.name}`);
              resolve(true);
            };
            deleteReq.onerror = () => {
              console.error(`❌ Failed to delete ${db.name}:`, deleteReq.error);
              reject(deleteReq.error);
            };
            deleteReq.onblocked = () => {
              console.warn(`⚠️ ${db.name} deletion blocked`);
              resolve(true);
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
        console.log(`🗑️ Deleted cache: ${cacheName}`);
      }
    }
    
    console.log('✅ Database reset complete! Reloading page...');
    setTimeout(() => window.location.reload(), 1000);
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
  }
};

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).resetDB = manualResetDB;
}
