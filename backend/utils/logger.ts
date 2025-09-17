// utils/logger.ts
import { createClient } from "@supabase/supabase-js";

// Use service role key for server-side logging
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function logError(message: string, stack?: string, context: any = {}) {
  await supabase.from("logs").insert([
    { level: "error", message, stack, context }
  ]);
}

export async function logWarn(message: string, context: any = {}) {
  await supabase.from("logs").insert([
    { level: "warn", message, context }
  ]);
}

export async function logInfo(message: string, context: any = {}) {
  await supabase.from("logs").insert([
    { level: "info", message, context }
  ]);
}
