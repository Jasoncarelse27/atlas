// utils/logger.mjs (JavaScript version)
import { createClient } from "@supabase/supabase-js";

// Lazy initialization of Supabase client
let supabase = null;

function getSupabaseClient() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

export async function logError(message, stack, context = {}) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return;
    }
    await client.from("logs").insert([
      { level: "error", message, stack, context }
    ]);
  } catch (error) {
    console.error('[Logger] Error logging error:', error);
  }
}

export async function logWarn(message, context = {}) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return;
    }
    await client.from("logs").insert([
      { level: "warn", message, context }
    ]);
  } catch (error) {
    console.error('[Logger] Error logging warning:', error);
  }
}

export async function logInfo(message, context = {}) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return;
    }
    
    const result = await client.from("logs").insert([
      { level: "info", message, context }
    ]);
    
    if (result.error) {
      console.error('[Logger] Error inserting info log:', result.error);
    } else {
      // Log inserted successfully
    }
  } catch (error) {
    console.error('[Logger] Error logging info:', error);
  }
}
