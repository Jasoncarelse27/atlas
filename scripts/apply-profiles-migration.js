#!/usr/bin/env node

/**
 * Apply profiles table migration manually
 * This script creates the profiles table and migrates data from user_profiles
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.join(process.cwd(), envFile) });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔄 Applying profiles table migration...');

  try {
    // 1. Create profiles table if it doesn't exist
    console.log('📋 Creating profiles table...');
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.profiles (
          id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
          email TEXT UNIQUE,
          subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'core', 'studio')),
          subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'trialing')),
          subscription_id TEXT,
          paddle_subscription_id TEXT,
          trial_ends_at TIMESTAMP WITH TIME ZONE,
          first_payment_date TIMESTAMP WITH TIME ZONE,
          last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (createError) {
      console.error('❌ Error creating profiles table:', createError);
      return;
    }
    console.log('✅ Profiles table created successfully');

    // 2. Create indexes
    console.log('📋 Creating indexes...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);
        CREATE INDEX IF NOT EXISTS profiles_subscription_tier_idx ON public.profiles (subscription_tier);
      `
    });

    if (indexError) {
      console.error('❌ Error creating indexes:', indexError);
      return;
    }
    console.log('✅ Indexes created successfully');

    // 3. Enable RLS
    console.log('📋 Enabling RLS...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      `
    });

    if (rlsError) {
      console.error('❌ Error enabling RLS:', rlsError);
      return;
    }
    console.log('✅ RLS enabled successfully');

    // 4. Create RLS policies
    console.log('📋 Creating RLS policies...');
    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can view own profile" ON public.profiles
          FOR SELECT USING (auth.uid() = id);

        CREATE POLICY "Users can update own profile" ON public.profiles
          FOR UPDATE USING (auth.uid() = id);
      `
    });

    if (policyError) {
      console.error('❌ Error creating policies:', policyError);
      return;
    }
    console.log('✅ RLS policies created successfully');

    // 5. Migrate data from user_profiles if it exists
    console.log('📋 Migrating data from user_profiles...');
    const { error: migrateError } = await supabase.rpc('exec_sql', {
      sql: `
        INSERT INTO public.profiles (id, email, subscription_tier, subscription_status, subscription_id, paddle_subscription_id, trial_ends_at, created_at, updated_at)
        SELECT 
          id, 
          email, 
          subscription_tier, 
          subscription_status, 
          subscription_id, 
          paddle_subscription_id, 
          trial_ends_at, 
          created_at, 
          updated_at
        FROM public.user_profiles
        WHERE NOT EXISTS (
          SELECT 1 FROM public.profiles WHERE profiles.id = user_profiles.id
        )
        ON CONFLICT (id) DO NOTHING;
      `
    });

    if (migrateError) {
      console.error('❌ Error migrating data:', migrateError);
      return;
    }
    console.log('✅ Data migration completed successfully');

    // 6. Insert existing users if they don't have a profile
    console.log('📋 Creating profiles for existing users...');
    const { error: insertError } = await supabase.rpc('exec_sql', {
      sql: `
        INSERT INTO public.profiles (id, email, subscription_tier)
        SELECT 
          au.id,
          au.email,
          'free'
        FROM auth.users au
        LEFT JOIN public.profiles p ON au.id = p.id
        WHERE p.id IS NULL
        ON CONFLICT (id) DO NOTHING;
      `
    });

    if (insertError) {
      console.error('❌ Error creating profiles for existing users:', insertError);
      return;
    }
    console.log('✅ Profiles created for existing users');

    console.log('🎉 Migration completed successfully!');
    console.log('✅ Profiles table is now ready for use');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration();
