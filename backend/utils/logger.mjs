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
      console.log(`[LOG-ERROR] ${message}`, { stack, context });
      return;
    }
    await client.from("logs").insert([
      { level: "error", message, stack, context }
    ]);
  } catch (error) {
    console.error("Failed to log to Supabase:", error.message);
  }
}

export async function logWarn(message, context = {}) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      console.log(`[LOG-WARN] ${message}`, { context });
      return;
    }
    await client.from("logs").insert([
      { level: "warn", message, context }
    ]);
  } catch (error) {
    console.error("Failed to log to Supabase:", error.message);
  }
}

export async function logInfo(message, context = {}) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      console.log(`[LOG-INFO] No Supabase client - ${message}`, { context });
      console.log(`[DEBUG] SUPABASE_URL: ${process.env.SUPABASE_URL ? 'SET' : 'NOT SET'}`);
      console.log(`[DEBUG] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}`);
      return;
    }
    
    console.log(`[LOG-INFO] Attempting to log to Supabase: ${message}`);
    const result = await client.from("logs").insert([
      { level: "info", message, context }
    ]);
    
    if (result.error) {
      console.error("Supabase insert error:", result.error);
    } else {
      console.log(`[LOG-INFO] Successfully logged to Supabase: ${message}`);
    }
  } catch (error) {
    console.error("Failed to log to Supabase:", error.message);
  }
}
