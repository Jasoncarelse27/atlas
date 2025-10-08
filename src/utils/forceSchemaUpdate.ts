// Force schema update by deleting the old database
export const forceSchemaUpdate = async () => {
  
  try {
    // Delete the old database to force schema recreation
    const deleteReq = indexedDB.deleteDatabase('AtlasDB');
    
    await new Promise((resolve, reject) => {
      deleteReq.onsuccess = () => {
        console.log('✅ Old database deleted');
        resolve(true);
      };
      deleteReq.onerror = () => {
        reject(deleteReq.error);
      };
      deleteReq.onblocked = () => {
        resolve(true);
      };
    });
    
    // Clear localStorage to remove any cached references
    localStorage.clear();
    sessionStorage.clear();
    
    console.log('✅ Schema update complete! Reloading page...');
    setTimeout(() => window.location.reload(), 1000);
    
  } catch (error) {
    // Force reload anyway
    window.location.reload();
  }
};

// Make it available globally
if (typeof window !== 'undefined') {
  (window as any).forceSchemaUpdate = forceSchemaUpdate;
}
