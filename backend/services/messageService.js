// backend/services/messageService.js
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Initialize clients lazily to ensure env vars are loaded
let anthropic = null;
let supabase = null;

function getAnthropic() {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
}

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

// ✅ Tier → Model map (updated to non-deprecated models)
const MODEL_MAP = {
  free: "claude-3-5-haiku-20241022",
  core: "claude-3-5-sonnet-20241022", 
  studio: "claude-3-5-sonnet-20241022",
};

/**
 * Get subscription tier for a user from Supabase profiles
 */
async function getUserTier(userId) {
  if (!userId) {
    console.log("⚠️ [MessageService] No userId provided, defaulting to 'free'");
    return "free";
  }

  try {
    const { data, error } = await getSupabase()
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("⚠️ [MessageService] Could not fetch profile:", error.message);
      return "free"; // Always default to free on error
    }

    const tier = data?.subscription_tier || "free";
    console.log(`✅ [MessageService] User ${userId} tier: ${tier}`);
    return tier;
  } catch (err) {
    console.error("❌ [MessageService] Error fetching tier:", err);
    return "free"; // Always default to free on exception
  }
}

/**
 * Process a message with Claude based on subscription tier
 */
export async function processMessage(userId, text) {
  console.log("🧠 [MessageService] Processing:", { userId, text });

  const tier = await getUserTier(userId);
  const model = MODEL_MAP[tier] || MODEL_MAP.free;

  try {
    const completion = await getAnthropic().messages.create({
      model,
      max_tokens: 512,
      messages: [{ role: "user", content: text }],
    });

    const reply = completion.content[0]?.text || "(no response)";
    console.log("🧠 [MessageService] Claude reply:", { tier, model, reply });

    return { reply, model, tier };

  } catch (err) {
    console.error("❌ [MessageService] Anthropic error:", err);
    return {
      reply: "⚠️ Atlas had an error contacting Claude. Please try again.",
      model,
      tier,
    };
  }
}
