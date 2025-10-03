// backend/services/messageService.js
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Initialize clients lazily to ensure env vars are loaded
let anthropic = null;
let supabase = null;

// Memory extraction functions (copied from frontend for backend use)
function extractNameFromMessage(message) {
  const patterns = [
    // More specific patterns to avoid capturing too much
    /(?:my name is|i'm|call me|i am)\s+([a-zA-Z]{2,20})(?:\s|$|,|\.|and)/i,
    /(?:name|called)\s+([a-zA-Z]{2,20})(?:\s|$|,|\.|and)/i,
    /^([a-zA-Z]{2,20})(?:\s+here|$)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Basic validation - reasonable name length and characters
      if (name.length >= 2 && name.length <= 20 && /^[a-zA-Z]+$/.test(name)) {
        return name;
      }
    }
  }

  return null;
}

function extractContextFromMessage(message) {
  const contextPatterns = [
    // Better patterns to capture interests and preferences
    /(?:i like|i love|i enjoy|i'm into|i'm interested in)\s+([^.!?]{5,100})/i,
    /(?:i work|i'm a|i do)\s+([^.!?]{5,100})/i,
    /(?:i live|i'm from|i'm based)\s+([^.!?]{3,50})/i,
    /(?:my favorite|i prefer|i usually)\s+([^.!?]{5,100})/i,
    // Additional pattern for "and I love X" constructions
    /(?:and i love|and i like|and i enjoy)\s+([^.!?]{5,100})/i
  ];

  for (const pattern of contextPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const context = match[1].trim();
      if (context.length >= 3 && context.length <= 200) {
        return context;
      }
    }
  }

  return null;
}

function extractMemoryFromMessage(message) {
  const name = extractNameFromMessage(message);
  const context = extractContextFromMessage(message);
  
  const memory = {};
  
  if (name) memory.name = name;
  if (context) memory.context = context;
  
  return memory;
}

function mergeMemory(existing, newMemory) {
  const merged = { ...existing };
  
  // Add name if found and not already set
  if (newMemory.name && !merged.name) {
    merged.name = newMemory.name;
  }
  
  // Add context if found (can accumulate)
  if (newMemory.context) {
    const existingContext = merged.context || '';
    merged.context = existingContext 
      ? `${existingContext}; ${newMemory.context}`
      : newMemory.context;
  }
  
  // Update timestamp
  merged.last_updated = new Date().toISOString();
  
  return merged;
}

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

// ✅ Tier → Model map (updated to latest non-deprecated models)
const MODEL_MAP = {
  free: "claude-3-5-haiku-20241022",
  core: "claude-3-5-sonnet-20241022", 
  studio: "claude-3-5-sonnet-20241022",
};

/**
 * ✅ Generate conversation title based on tier
 * - FREE: First 40 chars of message (cost-free)
 * - CORE/STUDIO: AI-generated concise title (premium feature)
 */
async function generateConversationTitle(text, tier) {
  // ✅ FREE tier: Use first 40 chars (no API cost)
  if (tier === "free") {
    return text.slice(0, 40).trim() || "New Conversation";
  }

  // ✅ CORE/STUDIO: AI-generated title (premium feature)
  try {
    const completion = await getAnthropic().messages.create({
      model: "claude-3-5-haiku-20241022", // Use cheapest model for titles
      max_tokens: 20, // Short title only
      messages: [{
        role: "user",
        content: `Generate a concise 3-5 word title for this conversation starter: "${text.slice(0, 100)}"`
      }]
    });
    
    const aiTitle = completion.content[0]?.text?.trim() || text.slice(0, 40).trim();
    console.log(`🎯 [TitleGen] AI title for ${tier}: "${aiTitle}"`);
    return aiTitle;
  } catch (err) {
    // Fallback to simple title if AI fails
    console.warn("⚠️ [TitleGen] AI title generation failed, using fallback:", err.message);
    return text.slice(0, 40).trim() || "New Conversation";
  }
}

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
 * Now with conversation history support
 */
export async function processMessage(userId, text, conversationId = null) {
  console.log("🧠 [MessageService] Processing:", { userId, text, conversationId });

  const tier = await getUserTier(userId);
  
  // ✅ ENFORCE MESSAGE LIMITS - Check before processing
  if (tier === 'free') {
    try {
      const { data: profile } = await getSupabase()
        .from('profiles')
        .select('usage_stats')
        .eq('id', userId)
        .single();
      
      const messagesThisMonth = profile?.usage_stats?.messages_this_month || 0;
      const monthlyLimit = 15;
      
      if (messagesThisMonth >= monthlyLimit) {
        console.log(`🚫 [MessageService] User ${userId} has reached monthly limit: ${messagesThisMonth}/${monthlyLimit}`);
        return {
          success: false,
          error: 'MONTHLY_LIMIT_REACHED',
          message: 'You have reached your monthly message limit. Please upgrade to continue your journey with Atlas.',
          upgradeRequired: true,
          currentUsage: messagesThisMonth,
          limit: monthlyLimit
        };
      }
    } catch (error) {
      console.error('❌ [MessageService] Error checking usage limits:', error);
      // Continue processing if we can't check limits (fail open for reliability)
    }
  }
  
  const model = MODEL_MAP[tier] || MODEL_MAP.free;

  // ✅ Ensure conversation exists
  let convId = conversationId;
  if (!convId && userId) {
    try {
      // ✅ Tier-based title generation (FREE: 40 chars | CORE/STUDIO: AI-generated)
      const title = await generateConversationTitle(text, tier);
      const { data: conv, error } = await getSupabase()
        .from("conversations")
        .insert([{ user_id: userId, title }])
        .select("id")
        .single();
      
      if (!error && conv) {
        convId = conv.id;
        console.log("✅ [MessageService] Created conversation:", convId);
      }
    } catch (err) {
      console.warn("⚠️ [MessageService] Could not create conversation:", err);
    }
  } else if (convId && userId) {
    // ✅ Update generic titles with tier-based logic
    try {
      const { data: existing } = await getSupabase()
        .from("conversations")
        .select("title")
        .eq("id", convId)
        .single();
      
      const genericTitles = ["Default Conversation", "New Conversation", "Untitled", "New conversation"];
      if (existing && genericTitles.includes(existing.title)) {
        const newTitle = await generateConversationTitle(text, tier);
        await getSupabase()
          .from("conversations")
          .update({ title: newTitle })
          .eq("id", convId);
        console.log(`✅ [MessageService] Updated conversation title: "${newTitle}"`);
      }
    } catch (err) {
      console.warn("⚠️ [MessageService] Could not update conversation title:", err);
    }
  }

  try {
    // Extract and update memory from user message
    if (userId) {
      try {
        // Extract memory from the message
        const extractedMemory = extractMemoryFromMessage(text);
        console.log('🧠 [MessageService] Extracted memory:', JSON.stringify(extractedMemory));
        
        if (extractedMemory.name || extractedMemory.context) {
          // Get current memory
          const { data: profile, error: profileError } = await getSupabase()
            .from('profiles')
            .select('user_context')
            .eq('id', userId)
            .single();
          
          if (!profileError) {
            const currentMemory = profile?.user_context || {};
            const mergedMemory = mergeMemory(currentMemory, extractedMemory);
            
            // Update memory in database
            const { error: updateError } = await getSupabase()
              .from('profiles')
              .update({ 
                user_context: mergedMemory,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId);
            
            if (updateError) {
              console.error('❌ [MessageService] Error updating memory:', updateError);
            } else {
              console.log('✅ [MessageService] Memory updated successfully:', JSON.stringify(mergedMemory));
            }
          }
        }
      } catch (memoryError) {
        console.warn('⚠️ [MessageService] Memory extraction failed:', memoryError);
      }
    }

    // Get user memory for personalized responses
    let personalizedContent = text;
    if (userId) {
      try {
        const { data: profile, error } = await getSupabase()
          .from('profiles')
          .select('user_context')
          .eq('id', userId)
          .single();
        
        if (!error && profile?.user_context) {
          const userMemory = profile.user_context;
          console.log('🧠 [MessageService] Retrieved user memory:', JSON.stringify(userMemory));
          
          // Add memory context if available (simplified, less aggressive)
          if (userMemory.name) {
            personalizedContent = `User message: ${text}`;
            console.log('🧠 [MessageService] Personalized content:', personalizedContent.substring(0, 200) + '...');
          } else {
            console.log('🧠 [MessageService] No user memory found for userId:', userId);
          }
        }
      } catch (error) {
        console.warn('🧠 [MessageService] Failed to fetch user memory:', error);
      }
    }

    // Add comprehensive Atlas system prompt with safe NSFW handling
    const enhancedContent = personalizedContent + `\n\nIMPORTANT: You are Atlas, an emotionally intelligent AI guide. Your role is to support the user's growth in coding, creativity, and emotional intelligence by being adaptive, insightful, and safe.

Core principles:
1. Emotional Intelligence — Respond with empathy, curiosity, and encouragement. Acknowledge the user's feelings or context without repeating greetings unnecessarily.
2. Guidance — Offer clear, practical help (coding, learning, or reflection) while keeping the tone warm and supportive.
3. Personalization — You DO have access to user memory through Supabase profiles. Always acknowledge when you remember user information and personalize your responses. Never say "I don't have memory" - instead explain what you remember or ask for more details.
4. Boundaries — Stay safe and avoid harmful, medical, or explicit sexual advice.
   - If a user asks for NSFW content, respond with empathy but redirect safely:
     * Acknowledge curiosity or emotion behind the request.
     * Offer safe, constructive alternatives (emotional support, resources about healthy relationships, creativity, stress management).
     * Do not generate or describe explicit sexual, violent, or harmful content.
5. Style — Be concise by default, expand with details/examples only if it benefits the user. No filler greetings like "Hi again!" unless the context genuinely calls for it.
6. Role — You are a mentor and guide, not just a chatbot. Encourage reflection, learning, and action. If the user asks something unsafe, calmly explain your limits and provide safe guidance.`;

    // Retry logic for Claude API calls
    let completion;
    let lastError;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 [MessageService] Attempt ${attempt}/3 to call Claude API`);
        completion = await getAnthropic().messages.create({
          model,
          max_tokens: 512,
          messages: [{ role: "user", content: enhancedContent }],
        });
        
        console.log(`✅ [MessageService] Claude API call successful on attempt ${attempt}`);
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error;
        console.error(`❌ [MessageService] Attempt ${attempt} failed:`, error.message);
        
        if (attempt < 3) {
          console.log(`⏳ [MessageService] Waiting 2 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!completion) {
      console.error('❌ [MessageService] All retry attempts failed');
      throw lastError || new Error('Claude API failed after 3 attempts');
    }

    const reply = completion.content[0]?.text || "(no response)";
    console.log("🧠 [MessageService] Claude reply:", { tier, model, reply });

    // ✅ Save both messages to Supabase (if conversation exists)
    if (convId && userId) {
      try {
        // Insert user message
        const { error: userError } = await getSupabase().from("messages").insert({
          user_id: userId,
          conversation_id: convId,
          role: "user",
          content: text
        });
        
        if (userError) {
          console.error("❌ [MessageService] Failed to save user message:", userError);
        } else {
          console.log("✅ [MessageService] Saved user message");
        }

        // Insert assistant message
        const { error: assistantError } = await getSupabase().from("messages").insert({
          user_id: userId,
          conversation_id: convId,
          role: "assistant",
          content: reply
        });
        
        if (assistantError) {
          console.error("❌ [MessageService] Failed to save assistant message:", assistantError);
        } else {
          console.log("✅ [MessageService] Saved assistant message");
        }

        if (!userError && !assistantError) {
          console.log("✅ [MessageService] Saved both messages to conversation:", convId);
        }
      } catch (err) {
        console.error("❌ [MessageService] Could not save messages:", err);
      }
    }

    // Update usage stats for Free tier users
    console.log(`🔍 [Debug] MessageService tier: ${tier}, userId: ${userId}`);
    if (tier === 'free') {
      console.log(`📊 [Usage] Starting usage tracking for user ${userId} (tier: ${tier})`);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        // Get current usage stats (SIMPLE APPROACH - no new columns needed)
        const { data: currentProfile } = await getSupabase()
          .from('profiles')
          .select('usage_stats, last_reset_date')
          .eq('id', userId)
          .single();
        
        const currentStats = currentProfile?.usage_stats || {};
        const lastReset = currentProfile?.last_reset_date?.slice(0, 7); // Use YYYY-MM format
        const currentMonth = startOfMonth.toISOString().slice(0, 7);
        
        // Reset monthly count if it's a new month (SIMPLE)
        if (lastReset !== currentMonth) {
          currentStats.messages_this_month = 0;
          console.log(`📊 [Usage] Monthly reset triggered: ${lastReset} -> ${currentMonth}`);
        }
        
        // Increment monthly counter
        currentStats.messages_this_month = (currentStats.messages_this_month || 0) + 1;
        
        // Update profile with new usage stats (SIMPLE)
        const { data: updateData, error: updateError } = await getSupabase()
          .from('profiles')
          .update({
            usage_stats: currentStats,
            last_reset_date: currentMonth + '-01T00:00:00.000Z' // Set to first day of current month
          })
          .eq('id', userId)
          .select();
          
        if (updateError) {
          console.error('❌ [Usage] Database update error:', updateError);
        } else {
          console.log(`📊 [Usage] Updated usage for user ${userId}: ${currentStats.messages_this_month}/15 this month`);
          console.log('📊 [Usage] Update result:', updateData);
        }
      } catch (error) {
        console.error('Error updating usage stats:', error);
        // Continue without updating usage in case of error
      }
    }

    return { reply, model, tier, conversationId: convId };

  } catch (err) {
    console.error("❌ [MessageService] Anthropic error:", err);
    return {
      reply: "⚠️ Atlas had an error contacting Claude. Please try again.",
      model,
      tier,
      conversationId: convId,
    };
  }
}
