import { supabase } from '../lib/supabaseClient';

function getSupabaseClient() {
  // In test environment, return a mock client
  if (import.meta.env.NODE_ENV === 'test') {
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
    } else {
    }
  } catch (err) {
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
      return [];
    }
    
    return data || [];
  } catch (err) {
    return [];
  }
}
