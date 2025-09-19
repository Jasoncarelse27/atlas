#!/usr/bin/env ts-node

/**
 * Atlas Test User Creation Script
 * 
 * Creates a test user for development and testing purposes.
 * This script is safe to run multiple times - it won't create duplicates.
 * 
 * Usage:
 *   npm run create-test-user
 * 
 * Environment Variables Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load from different env files
const envFiles = ['.env.local', '.env.production', '.env'];
for (const envFile of envFiles) {
  const envPath = path.join(__dirname, '..', envFile);
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  console.error('');
  console.error('💡 Make sure you have these in your .env.local or .env.production file');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function createTestUser() {
  const testEmail = 'test@atlas.app';
  const testPassword = 'password123';

  try {
    console.log('🔧 Creating test user for Atlas...');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);

    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error checking existing users:', listError.message);
      return false;
    }

    const existingUser = existingUsers.users.find(user => user.email === testEmail);
    
    if (existingUser) {
      console.log('✅ Test user already exists');
      console.log(`   User ID: ${existingUser.id}`);
      console.log(`   Created: ${existingUser.created_at}`);
      
      // Ensure user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', existingUser.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: existingUser.id,
            email: testEmail,
            subscription_tier: 'free',
            subscription_status: 'inactive'
          });

        if (insertError) {
          console.error('❌ Error creating user profile:', insertError.message);
          return false;
        }
        
        console.log('✅ Created user profile');
      } else if (profileError) {
        console.error('❌ Error checking user profile:', profileError.message);
        return false;
      } else {
        console.log('✅ User profile already exists');
      }

      return true;
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Skip email confirmation
    });

    if (createError) {
      console.error('❌ Error creating test user:', createError.message);
      return false;
    }

    if (!newUser.user) {
      console.error('❌ No user returned from creation');
      return false;
    }

    console.log('✅ Test user created successfully');
    console.log(`   User ID: ${newUser.user.id}`);
    console.log(`   Email: ${newUser.user.email}`);

    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: newUser.user.id,
        email: testEmail,
        subscription_tier: 'free',
        subscription_status: 'inactive'
      });

    if (profileError) {
      console.error('❌ Error creating user profile:', profileError.message);
      return false;
    }

    console.log('✅ User profile created');

    return true;

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Atlas Test User Creation Script');
  console.log('=====================================');
  
  const success = await createTestUser();
  
  if (success) {
    console.log('');
    console.log('🎉 Test user setup complete!');
    console.log('');
    console.log('📝 You can now:');
    console.log('   1. Sign in to Atlas with: test@atlas.app / password123');
    console.log('   2. Test the auth system and usage indicators');
    console.log('   3. Verify tier enforcement is working');
  } else {
    console.log('');
    console.error('💥 Test user creation failed');
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
