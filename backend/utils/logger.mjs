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
      console.log(`[LOG-INFO] ${message}`, { context });
      return;
    }
    await client.from("logs").insert([
      { level: "info", message, context }
    ]);
  } catch (error) {
    console.error("Failed to log to Supabase:", error.message);
  }
}
