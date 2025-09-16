import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function main() {
  console.log('🔍 Checking recent email failures...\n');

  // Check if Supabase credentials are available
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('⚠️  Supabase credentials not found. Skipping email failure check.');
    console.log('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
    console.log('   Or use VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as fallback.');
    process.exit(0);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from('email_failures')
      .select('recipient, template, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error("❌ Error fetching email failures:", error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log("✅ No email failures found.");
      process.exit(0);
    }

    console.log("📧 Last 10 Email Failures:");
    data.forEach((f, i) => {
      console.log(
        `${i + 1}. [${f.created_at}] → ${f.recipient} (${f.template})\n   ❌ ${f.error_message}\n`
      );
    });

  } catch (err) {
    console.error('❌ Unexpected error:', err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
  }
}

main().catch(console.error);
