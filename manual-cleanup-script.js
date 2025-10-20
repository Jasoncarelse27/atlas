/**
 * ONE-TIME MANUAL CLEANUP
 * Run this ONCE in the browser console to fix duplicate conversations
 * 
 * Instructions:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter
 * 4. Wait for "Cleanup complete!" message
 * 5. Refresh the page
 */

(async function cleanupConversations() {
  console.log('🧹 Starting one-time conversation cleanup...');
  
  try {
    // Get current user
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) {
      console.error('❌ No user found. Please log in first.');
      return;
    }
    
    console.log('✅ User found:', user.id);
    
    // Open IndexedDB
    const dbRequest = indexedDB.open('AtlasDB_v8');
    
    dbRequest.onsuccess = async (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      
      // Get all conversations for this user
      const getAllRequest = store.index('userId').getAll(user.id);
      
      getAllRequest.onsuccess = async () => {
        const allConversations = getAllRequest.result;
        console.log(`📊 Found ${allConversations.length} local conversations`);
        
        // Delete all local conversations
        const deleteTransaction = db.transaction(['conversations'], 'readwrite');
        const deleteStore = deleteTransaction.objectStore('conversations');
        
        for (const conv of allConversations) {
          deleteStore.delete(conv.id);
        }
        
        deleteTransaction.oncomplete = async () => {
          console.log('✅ Cleared all local conversations');
          
          // Re-sync from Supabase
          const { data: activeConversations, error } = await window.supabase
            .from('conversations')
            .select('*')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false });
          
          if (error) {
            console.error('❌ Failed to fetch from Supabase:', error);
            return;
          }
          
          console.log(`📥 Fetched ${activeConversations?.length || 0} active conversations from Supabase`);
          
          // Add them back
          if (activeConversations && activeConversations.length > 0) {
            const addTransaction = db.transaction(['conversations'], 'readwrite');
            const addStore = addTransaction.objectStore('conversations');
            
            for (const conv of activeConversations) {
              addStore.add({
                id: conv.id,
                userId: conv.user_id,
                title: conv.title,
                createdAt: conv.created_at,
                updatedAt: conv.updated_at
              });
            }
            
            addTransaction.oncomplete = () => {
              console.log('✅ Re-synced conversations to local database');
              console.log('🎉 Cleanup complete! Refresh the page now.');
              
              // Clear cache
              localStorage.removeItem('atlas:conversationsCache');
            };
            
            addTransaction.onerror = (error) => {
              console.error('❌ Failed to add conversations:', error);
            };
          } else {
            console.log('ℹ️ No active conversations found in Supabase');
            console.log('🎉 Cleanup complete! Refresh the page now.');
          }
        };
      };
      
      getAllRequest.onerror = (error) => {
        console.error('❌ Failed to get conversations:', error);
      };
    };
    
    dbRequest.onerror = (error) => {
      console.error('❌ Failed to open database:', error);
    };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
})();

