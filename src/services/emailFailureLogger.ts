import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export async function logEmailFailure(recipient: string, template: string, error: string) {
  try {
    const { error: dbError } = await supabase.from("email_failures").insert([
      {
        recipient,
        template,
        error_message: error,
      },
    ]);
    
    if (dbError) {
      console.error("[MailerService] Failed to log email failure:", dbError.message);
    } else {
      console.log(`[MailerService] Logged email failure for ${recipient} (${template})`);
    }
  } catch (err) {
    console.error("[MailerService] Error logging email failure:", err);
  }
}
