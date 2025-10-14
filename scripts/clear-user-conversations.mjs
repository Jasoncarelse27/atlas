#!/usr/bin/env node
// Script to clear all conversations for a specific user
// Usage: node scripts/clear-user-conversations.mjs <email>

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearUserConversations(email) {
  try {
    console.log(`\n🔍 Looking up user: ${email}...`);
    
    // Get user ID from email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, subscription_tier')
      .eq('email', email)
      .single();
    
    if (profileError || !profile) {
      console.error(`❌ User not found: ${email}`);
      console.error('Error:', profileError);
      process.exit(1);
    }
    
    const userId = profile.id;
    console.log(`✅ Found user: ${profile.email} (${userId})`);
    console.log(`   Tier: ${profile.subscription_tier}`);
    
    // Count conversations before deletion
    const { count: conversationCount, error: countError } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (countError) {
      console.error('❌ Error counting conversations:', countError);
      process.exit(1);
    }
    
    console.log(`\n📊 Found ${conversationCount} conversations to delete`);
    
    if (conversationCount === 0) {
      console.log('✅ No conversations to delete!');
      process.exit(0);
    }
    
    // Confirm deletion
    console.log(`\n⚠️  This will permanently delete ALL ${conversationCount} conversations for ${email}`);
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🗑️  Deleting conversations...');
    
    // Delete all conversations (CASCADE will delete messages automatically)
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('user_id', userId);
    
    if (deleteError) {
      console.error('❌ Error deleting conversations:', deleteError);
      process.exit(1);
    }
    
    console.log(`✅ Successfully deleted ${conversationCount} conversations!`);
    
    // Verify deletion
    const { count: remainingCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    console.log(`\n📊 Verification: ${remainingCount} conversations remaining`);
    
    if (remainingCount === 0) {
      console.log('✅ All conversations successfully cleared!');
    } else {
      console.log(`⚠️  Warning: ${remainingCount} conversations still exist`);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: node scripts/clear-user-conversations.mjs <email>');
  console.error('   Example: node scripts/clear-user-conversations.mjs jasonc.jpg@gmail.com');
  process.exit(1);
}

clearUserConversations(email);

