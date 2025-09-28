// Immediate database reset - call this right now
import { preserveLocalStorage } from './preserveLocalStorage';

export const immediateReset = async () => {
  console.log('🚨 IMMEDIATE RESET: Forcing complete database deletion...');
  
  try {
    // Delete IndexedDB databases
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
    
    console.log('✅ IMMEDIATE RESET COMPLETE! Reloading page...');
    window.location.reload();
    
  } catch (error) {
    console.error('❌ IMMEDIATE RESET FAILED:', error);
    window.location.reload();
  }
};

// Make it available globally
if (typeof window !== 'undefined') {
  (window as any).immediateReset = immediateReset;
  console.log('🚨 IMMEDIATE RESET AVAILABLE: Run immediateReset() in console');
}
