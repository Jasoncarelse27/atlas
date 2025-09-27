// Utility to clear Dexie database and force rebuild
export const clearDexieDB = async () => {
  try {
    // Clear localStorage keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('atlas') || key.includes('dexie') || key.includes('AtlasDB'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage keys  
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('atlas') || key.includes('dexie') || key.includes('AtlasDB'))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

    // Delete IndexedDB
    if ('indexedDB' in window) {
      const deleteReq = indexedDB.deleteDatabase('AtlasDB');
      await new Promise((resolve, reject) => {
        deleteReq.onsuccess = () => resolve(true);
        deleteReq.onerror = () => reject(deleteReq.error);
        deleteReq.onblocked = () => {
          console.warn('[CLEAR] IndexedDB deletion blocked');
          resolve(true);
        };
      });
    }

    console.log('[CLEAR] Dexie database cleared successfully');
    return true;
  } catch (error) {
    console.error('[CLEAR] Failed to clear Dexie database:', error);
    return false;
  }
};
