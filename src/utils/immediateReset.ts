// Immediate database reset - call this right now
export const immediateReset = async () => {
  console.log('🚨 IMMEDIATE RESET: Forcing complete database deletion...');
  
  try {
    // Delete the specific database
    const deleteReq = indexedDB.deleteDatabase('AtlasDB');
    
    await new Promise((resolve) => {
      deleteReq.onsuccess = () => {
        console.log('✅ AtlasDB deleted');
        resolve(true);
      };
      deleteReq.onerror = () => {
        console.error('❌ Failed to delete AtlasDB:', deleteReq.error);
        resolve(true); // Continue anyway
      };
      deleteReq.onblocked = () => {
        console.warn('⚠️ AtlasDB deletion blocked, but continuing...');
        resolve(true);
      };
    });
    
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    }
    
    console.log('✅ IMMEDIATE RESET COMPLETE! Reloading page...');
    // Force reload immediately
    window.location.reload();
    
  } catch (error) {
    console.error('❌ IMMEDIATE RESET FAILED:', error);
    // Force reload anyway
    window.location.reload();
  }
};

// Make it available globally
if (typeof window !== 'undefined') {
  (window as any).immediateReset = immediateReset;
  console.log('🚨 IMMEDIATE RESET AVAILABLE: Run immediateReset() in console');
}
