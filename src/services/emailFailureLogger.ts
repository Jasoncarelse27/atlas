import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client
let supabase: any = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    // In test environment or when env vars are missing, return a mock client
    if (!supabaseUrl || !supabaseKey) {
      if (import.meta.env.NODE_ENV === 'test' || import.meta.env.NODE_ENV === 'development') {
        console.log("[MailerService] Using mock Supabase client for tests/development");
        return {
          from: () => ({
            insert: () => ({ error: null }),
            select: () => ({
              order: () => ({
                limit: () => ({ data: [], error: null })
              })
            })
          })
        };
      }
      console.warn("[MailerService] Missing Supabase environment variables - using mock client");
      return {
        from: () => ({
          insert: () => ({ error: null }),
          select: () => ({
            order: () => ({
              limit: () => ({ data: [], error: null })
            })
          })
        })
      };
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

export async function logEmailFailure(recipient: string, template: string, error: string) {
  try {
    const client = getSupabaseClient();
    const { error: dbError } = await client.from("email_failures").insert([
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

export async function getRecentFailures(limit = 20) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("email_failures")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error("[MailerService] Failed to fetch recent failures:", error.message);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error("[MailerService] Error fetching recent failures:", err);
    return [];
  }
}
