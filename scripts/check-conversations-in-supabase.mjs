#!/usr/bin/env node
/**
 * Direct Supabase query to check if conversations exist
 * Run this to diagnose why sync isn't finding conversations
 * 
 * Usage: node scripts/check-conversations-in-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConversations() {
  console.log('🔍 Checking conversations in Supabase...\n');
  
  // Get user ID from command line or prompt
  const userId = process.argv[2];
  
  if (!userId) {
    console.error('❌ Please provide user ID as argument:');
    console.error('   node scripts/check-conversations-in-supabase.mjs <user-id>');
    console.error('\n💡 To get your user ID:');
    console.error('   1. Open browser console');
    console.error('   2. Run: (await supabase.auth.getUser()).data.user.id');
    process.exit(1);
  }
  
  console.log(`📋 Checking conversations for user: ${userId.slice(0, 8)}...\n`);
  
  // Check ALL conversations (including deleted)
  const { data: allConversations, error: allError } = await supabase
    .from('conversations')
    .select('id, title, user_id, created_at, updated_at, deleted_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20);
  
  if (allError) {
    console.error('❌ Error fetching conversations:', allError);
    process.exit(1);
  }
  
  console.log(`📊 Total conversations found: ${allConversations?.length || 0}\n`);
  
  if (!allConversations || allConversations.length === 0) {
    console.log('⚠️  No conversations found in Supabase for this user.');
    console.log('   This means conversations were never created or were deleted.');
    return;
  }
  
  // Separate active vs deleted
  const active = allConversations.filter(c => !c.deleted_at);
  const deleted = allConversations.filter(c => c.deleted_at);
  
  console.log(`✅ Active conversations: ${active.length}`);
  console.log(`🗑️  Deleted conversations: ${deleted.length}\n`);
  
  if (active.length > 0) {
    console.log('📋 Active conversations:');
    active.forEach((conv, i) => {
      console.log(`   ${i + 1}. ${conv.title || '(Untitled)'}`);
      console.log(`      ID: ${conv.id}`);
      console.log(`      Updated: ${new Date(conv.updated_at).toLocaleString()}`);
      console.log('');
    });
  }
  
  if (deleted.length > 0) {
    console.log('🗑️  Deleted conversations:');
    deleted.forEach((conv, i) => {
      console.log(`   ${i + 1}. ${conv.title || '(Untitled)'}`);
      console.log(`      ID: ${conv.id}`);
      console.log(`      Deleted: ${new Date(conv.deleted_at).toLocaleString()}`);
      console.log('');
    });
  }
  
  // Test the exact query delta sync uses
  console.log('🔍 Testing delta sync query (first sync - no date filter)...');
  const { data: firstSyncResults, error: firstSyncError } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(50);
  
  if (firstSyncError) {
    console.error('❌ First sync query error:', firstSyncError);
  } else {
    console.log(`✅ First sync query found: ${firstSyncResults?.length || 0} conversations\n`);
  }
}

checkConversations().catch(console.error);

