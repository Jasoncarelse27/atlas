#!/usr/bin/env node

/**
 * Developer tool to check recent email failures
 * Usage: npm run check:failures
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function checkEmailFailures() {
  console.log('🔍 Checking recent email failures...\n');

  // Check if Supabase credentials are available
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('⚠️  Supabase credentials not found. Skipping email failure check.');
    console.log('   Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
    return;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Fetch recent failures
    const { data, error } = await supabase
      .from('email_failures')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching email failures:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('✅ No recent email failures found!');
      return;
    }

    console.log(`📧 Found ${data.length} recent email failures:\n`);

    data.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure.recipient}`);
      console.log(`   Template: ${failure.template}`);
      console.log(`   Error: ${failure.error_message}`);
      console.log(`   Time: ${new Date(failure.created_at).toLocaleString()}`);
      console.log('');
    });

    console.log('💡 View all failures in Supabase: email_failures table');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

// Run the check
checkEmailFailures().catch(console.error);
