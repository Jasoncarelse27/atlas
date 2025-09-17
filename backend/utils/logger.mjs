// utils/logger.mjs (JavaScript version)
import { createClient } from "@supabase/supabase-js";

// Use service role key for server-side logging
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function logError(message, stack, context = {}) {
  try {
    await supabase.from("logs").insert([
      { level: "error", message, stack, context }
    ]);
  } catch (error) {
    console.error("Failed to log to Supabase:", error.message);
  }
}

export async function logWarn(message, context = {}) {
  try {
    await supabase.from("logs").insert([
      { level: "warn", message, context }
    ]);
  } catch (error) {
    console.error("Failed to log to Supabase:", error.message);
  }
}

export async function logInfo(message, context = {}) {
  try {
    await supabase.from("logs").insert([
      { level: "info", message, context }
    ]);
  } catch (error) {
    console.error("Failed to log to Supabase:", error.message);
  }
}
