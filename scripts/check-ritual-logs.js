/**
 * Check if any ritual logs exist in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkRitualLogs() {
  console.log('🔍 Checking for existing ritual logs...\n');

  try {
    // Try to count logs (without RLS, this might return 0)
    const { count, error } = await supabase
      .from('ritual_logs')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('⚠️  Cannot count logs (expected if RLS is enabled):', error.message);
      console.log('   This is NORMAL - RLS blocks anonymous access');
    } else {
      console.log(`📊 Total ritual logs in database: ${count || 0}`);
    }

    // Try to fetch recent logs
    const { data: recentLogs, error: fetchError } = await supabase
      .from('ritual_logs')
      .select('id, created_at, mood_before, mood_after, duration_seconds')
      .order('completed_at', { ascending: false })
      .limit(5);

    if (fetchError) {
      console.log('\n⚠️  Cannot fetch logs (expected if RLS is enabled):', fetchError.message);
      console.log('   Logs can only be viewed by authenticated users');
    } else if (recentLogs && recentLogs.length > 0) {
      console.log(`\n✅ Found ${recentLogs.length} recent logs:`);
      recentLogs.forEach((log, i) => {
        console.log(`   ${i + 1}. ${log.mood_before} → ${log.mood_after} (${log.duration_seconds}s)`);
      });
    } else {
      console.log('\n📭 No ritual logs found yet');
    }

    console.log('\n' + '='.repeat(50));
    console.log('\n💡 To view your personal ritual logs:');
    console.log('   1. Log in to the app');
    console.log('   2. Complete a ritual');
    console.log('   3. Check browser console: window.supabase.from("ritual_logs").select("*")');
    console.log('\n' + '='.repeat(50));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRitualLogs();

