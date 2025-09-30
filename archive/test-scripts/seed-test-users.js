#!/usr/bin/env node

/**
 * Atlas Test User Seeding Script
 * Creates test users for tier gating validation
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

const TEST_USERS = [
  {
    email: 'free_tester@atlas.app',
    password: 'Test1234!',
    tier: 'free',
    fullName: 'Free Tester'
  },
  {
    email: 'core_tester@atlas.app',
    password: 'Test1234!',
    tier: 'core',
    fullName: 'Core Tester'
  },
  {
    email: 'studio_tester@atlas.app',
    password: 'Test1234!',
    tier: 'studio',
    fullName: 'Studio Tester'
  }
];

async function seedTestUsers() {
  console.log('🧪 Atlas Test User Seeding Script');
  console.log('==================================');
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (const user of TEST_USERS) {
    try {
      console.log(`📝 Creating ${user.tier} tier user: ${user.email}`);
      
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`   ⚠️  User already exists, updating tier...`);
          
          // Get existing user by listing all users and finding by email
          const { data: usersData } = await supabase.auth.admin.listUsers();
          const existingUser = usersData?.users?.find(u => u.email === user.email);
          if (existingUser) {
            // Update profile with correct tier
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({
                id: existingUser.id,
                email: user.email,
                subscription_tier: user.tier,
                subscription_status: 'active',
                full_name: user.fullName,
                updated_at: new Date().toISOString()
              });

            if (profileError) {
              console.log(`   ❌ Failed to update profile: ${profileError.message}`);
              errorCount++;
            } else {
              console.log(`   ✅ Profile updated to ${user.tier} tier`);
              successCount++;
            }
          }
        } else {
          console.log(`   ❌ Auth creation failed: ${authError.message}`);
          errorCount++;
        }
        continue;
      }

      if (!authData.user) {
        console.log(`   ❌ No user data returned`);
        errorCount++;
        continue;
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: user.email,
          subscription_tier: user.tier,
          subscription_status: 'active',
          full_name: user.fullName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.log(`   ❌ Profile creation failed: ${profileError.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Created ${user.tier} tier user successfully`);
        successCount++;
      }

    } catch (error) {
      console.log(`   ❌ Unexpected error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('');

  if (successCount > 0) {
    console.log('🎯 Test users ready for validation:');
    console.log('   • free_tester@atlas.app (password: Test1234!)');
    console.log('   • core_tester@atlas.app (password: Test1234!)');
    console.log('   • studio_tester@atlas.app (password: Test1234!)');
    console.log('');
    console.log('💡 Next: Run tier gating validation tests');
  }

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run the script
seedTestUsers().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
