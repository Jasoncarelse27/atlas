#!/usr/bin/env node

// Atlas Test User Seeder
// Creates synthetic users for soft-launch testing

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_USERS = [
  { email: 'test-free-1@atlas-demo.com', tier: 'free', name: 'Free User 1' },
  { email: 'test-free-2@atlas-demo.com', tier: 'free', name: 'Free User 2' },
  { email: 'test-free-3@atlas-demo.com', tier: 'free', name: 'Free User 3' },
  { email: 'test-free-4@atlas-demo.com', tier: 'free', name: 'Free User 4' },
  { email: 'test-free-5@atlas-demo.com', tier: 'free', name: 'Free User 5' },
  { email: 'test-free-6@atlas-demo.com', tier: 'free', name: 'Free User 6' },
  { email: 'test-free-7@atlas-demo.com', tier: 'free', name: 'Free User 7' },
  { email: 'test-free-8@atlas-demo.com', tier: 'free', name: 'Free User 8' },
  { email: 'test-core-1@atlas-demo.com', tier: 'core', name: 'Core User 1' },
  { email: 'test-core-2@atlas-demo.com', tier: 'core', name: 'Core User 2' },
  { email: 'test-studio-1@atlas-demo.com', tier: 'studio', name: 'Studio User 1' }
];

async function createTestUsers() {
  console.log('🧪 Creating Atlas test users...\n');

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const user of TEST_USERS) {
    try {
      // Create or get user ID
      let userId;
      
      // Check if user already exists in auth.users
      const { data: existingUser, error: searchError } = await supabase.auth.admin.listUsers();
      
      if (searchError) {
        console.error(`❌ Error searching for ${user.email}:`, searchError.message);
        errors++;
        continue;
      }

      const foundUser = existingUser.users.find(u => u.email === user.email);
      
      if (foundUser) {
        userId = foundUser.id;
        console.log(`👤 User exists: ${user.email} (${userId})`);
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: user.email,
          email_confirm: true,
          user_metadata: {
            name: user.name,
            test_user: true
          }
        });

        if (createError) {
          console.error(`❌ Error creating ${user.email}:`, createError.message);
          errors++;
          continue;
        }

        userId = newUser.user.id;
        console.log(`✅ Created user: ${user.email} (${userId})`);
        created++;
      }

      // Create or update profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          email: user.email,
          subscription_tier: user.tier,
          full_name: user.name,
          test_user: true
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error(`❌ Error creating profile for ${user.email}:`, profileError.message);
        errors++;
        continue;
      }

      // Initialize tier usage
      const { error: usageError } = await supabase
        .from('tier_usage')
        .upsert({
          user_id: userId,
          tier: user.tier,
          message_count: Math.floor(Math.random() * (user.tier === 'free' ? 15 : 50)),
          cost_accumulated: Math.random() * (user.tier === 'free' ? 0.75 : 5.0),
          last_reset: new Date().toISOString()
        }, {
          onConflict: 'user_id,tier'
        });

      if (usageError) {
        console.warn(`⚠️  Warning: Could not initialize usage for ${user.email}:`, usageError.message);
      }

      console.log(`📊 Profile updated: ${user.email} → ${user.tier} tier`);
      
      if (!foundUser) {
        updated++;
      }

    } catch (error) {
      console.error(`❌ Unexpected error for ${user.email}:`, error.message);
      errors++;
    }
  }

  console.log('\n📊 Test User Creation Summary:');
  console.log(`✅ Created: ${created} users`);
  console.log(`📝 Updated: ${updated} users`);
  console.log(`❌ Errors: ${errors} users`);
  console.log(`📋 Total: ${TEST_USERS.length} users processed`);

  if (errors === 0) {
    console.log('\n🎉 All test users created successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Run tier enforcement tests');
    console.log('2. Generate usage snapshots');
    console.log('3. Test CSV exports');
    console.log('4. Verify weekly reports');
  } else {
    console.log(`\n⚠️  Completed with ${errors} errors. Check logs above.`);
  }
}

// Run the seeder
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestUsers()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { createTestUsers };
