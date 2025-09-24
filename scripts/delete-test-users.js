#!/usr/bin/env node

/**
 * Atlas Test User Cleanup Script
 * Removes test users after validation is complete
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('💡 Set them with:');
  console.error('   export SUPABASE_URL="https://your-project-id.supabase.co"');
  console.error('   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TEST_USER_EMAILS = [
  'free_tester@atlas.app',
  'core_tester@atlas.app',
  'studio_tester@atlas.app'
];

async function deleteTestUsers() {
  console.log('🧹 Atlas Test User Cleanup Script');
  console.log('==================================');
  console.log('');

  let successCount = 0;
  let errorCount = 0;
  let notFoundCount = 0;

  for (const email of TEST_USER_EMAILS) {
    try {
      console.log(`🗑️  Deleting test user: ${email}`);
      
      // Get user by email
      const { data: userData, error: getUserError } = await supabase.auth.admin.getUserByEmail(email);
      
      if (getUserError) {
        console.log(`   ❌ Failed to get user: ${getUserError.message}`);
        errorCount++;
        continue;
      }

      if (!userData.user) {
        console.log(`   ⚠️  User not found (may already be deleted)`);
        notFoundCount++;
        continue;
      }

      const userId = userData.user.id;

      // Delete profile first
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.log(`   ⚠️  Profile deletion warning: ${profileError.message}`);
      } else {
        console.log(`   ✅ Profile deleted`);
      }

      // Delete auth user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) {
        console.log(`   ❌ Auth deletion failed: ${deleteError.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Auth user deleted successfully`);
        successCount++;
      }

    } catch (error) {
      console.log(`   ❌ Unexpected error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('📊 Cleanup Summary:');
  console.log(`   ✅ Deleted: ${successCount}`);
  console.log(`   ⚠️  Not found: ${notFoundCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('');

  if (successCount > 0 || notFoundCount > 0) {
    console.log('🎯 Test users cleaned up successfully');
    console.log('💡 Test environment is now clean');
  }

  if (errorCount > 0) {
    console.log('⚠️  Some errors occurred during cleanup');
    process.exit(1);
  }
}

// Run the script
deleteTestUsers().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
