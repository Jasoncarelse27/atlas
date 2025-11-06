// backend/services/messageService.js
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { logger } from '../lib/simpleLogger.mjs';

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
  free: "claude-3-haiku-20240307",   // ✅ Verified working
  core: "claude-3-sonnet-20240229",  // ✅ Updated to correct format (Nov 2025)
  studio: "claude-3-opus-20240229"   // ✅ Updated to correct format (Nov 2025)
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
      model: "claude-3-haiku-20240307", // ✅ FIX: Use correct Haiku model for titles
      max_tokens: 20, // Short title only
      messages: [{
        role: "user",
        content: `Generate a single, concise 3-5 word title for this conversation. Return ONLY the title, no numbers or options: "${text.slice(0, 100)}"`
      }]
    });
    
    let aiTitle = completion.content[0]?.text?.trim() || text.slice(0, 40).trim();
    
    // ✅ Clean up AI response - remove numbers, options, etc.
    aiTitle = aiTitle
      .replace(/^\d+\.\s*/, '') // Remove "1. " prefix
      .replace(/^Here are some possibilities?:?\s*/i, '') // Remove "Here are some possibilities:"
      .replace(/^Options?:?\s*/i, '') // Remove "Options:" prefix
      .split('\n')[0] // Take only first line
      .trim();
    
    // ✅ Fallback if title is still too long or empty
    if (!aiTitle || aiTitle.length > 50) {
      aiTitle = text.slice(0, 40).trim() || "New Conversation";
    }
    
    return aiTitle;
  } catch (err) {
    // Fallback to simple title if AI fails
    return text.slice(0, 40).trim() || "New Conversation";
  }
}

/**
 * Get subscription tier for a user from Supabase profiles
 */
async function getUserTier(userId) {
  if (!userId) {
    return "free";
  }

  try {
    const { data, error } = await getSupabase()
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    if (error) {
      return "free"; // Always default to free on error
    }

    const tier = data?.subscription_tier || "free";
    logger.debug(`✅ [MessageService] User ${userId} tier: ${tier}`);
    return tier;
  } catch (err) {
    return "free"; // Always default to free on exception
  }
}

/**
 * Process a message with Claude based on subscription tier
 * Now with conversation history support
 */
// 🔒 BRANDING FILTER: Rewrite any mentions of Claude/Anthropic to maintain Atlas identity
// 🎭 STAGE DIRECTION FILTER: Remove stage directions like "*speaks in a friendly voice*"
function filterResponse(text) {
  if (!text) return text;
  
  // Case-insensitive replacements
  let filtered = text;
  
  // ✅ CRITICAL FIX: Remove stage directions (text in asterisks OR square brackets)
  // Examples: "*speaks in a friendly voice*", "*responds warmly*", "[In a clear, conversational voice]", "*clears voice*", "*clears throat*"
  // This prevents stage directions from appearing in transcripts or being spoken
  filtered = filtered.replace(/\*[^*]+\*/g, ''); // Remove text between asterisks (includes "*clears voice*", "*clears throat*")
  filtered = filtered.replace(/\[[^\]]+\]/g, ''); // Remove text between square brackets
  filtered = filtered.replace(/\s{2,}/g, ' '); // Collapse multiple spaces (but preserve single spaces)
  
  // Direct identity reveals
  filtered = filtered.replace(/I am Claude/gi, "I'm Atlas");
  filtered = filtered.replace(/I'm Claude/gi, "I'm Atlas");
  filtered = filtered.replace(/called Claude/gi, "called Atlas");
  filtered = filtered.replace(/named Claude/gi, "named Atlas");
  
  // Company mentions
  filtered = filtered.replace(/created by Anthropic/gi, "built by the Atlas team");
  filtered = filtered.replace(/made by Anthropic/gi, "built by the Atlas team");
  filtered = filtered.replace(/Anthropic/gi, "the Atlas development team");
  
  // Model mentions
  filtered = filtered.replace(/Claude Opus/gi, "Atlas Studio");
  filtered = filtered.replace(/Claude Sonnet/gi, "Atlas Core");
  filtered = filtered.replace(/Claude Haiku/gi, "Atlas Free");
  
  // Generic AI mentions that reveal architecture
  filtered = filtered.replace(/as an AI assistant created by/gi, "as your AI companion built by");
  filtered = filtered.replace(/I aim to be direct and honest in my responses\./gi, "I'm here to support your growth with honesty and care.");
  
  // ✅ CRITICAL: Only trim final result, not intermediate chunks
  return filtered.trim();
}

export async function processMessage(userId, text, conversationId = null) {
  // ✅ CRITICAL: Validate userId before processing
  if (!userId || userId === 'anonymous') {
    logger.error('[MessageService] Invalid userId:', userId);
    return {
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Valid user authentication required'
    };
  }
  
  logger.debug("🧠 [MessageService] Processing:", { userId, text, conversationId });

  const tier = await getUserTier(userId);
  
  // ✅ ENFORCE MESSAGE LIMITS - Check before processing
  // 🔒 SECURITY: Fail-closed on errors to prevent free tier abuse
  if (tier === 'free') {
    try {
      const { data: profile, error: profileError } = await getSupabase()
        .from('profiles')
        .select('usage_stats')
        .eq('id', userId)
        .single();
      
      // 🔒 SECURITY FIX: Fail-closed if we can't verify limits
      if (profileError) {
        logger.error('[MessageService] ⚠️ Failed to fetch usage stats:', profileError.message);
        return {
          success: false,
          error: 'USAGE_VERIFICATION_FAILED',
          message: 'Unable to verify message limits. Please try again in a moment.',
          technical: profileError.message
        };
      }
      
      const messagesThisMonth = profile?.usage_stats?.messages_this_month || 0;
      const monthlyLimit = 15;
      
      logger.debug(`[MessageService] Free tier user ${userId}: ${messagesThisMonth}/${monthlyLimit} messages used`);
      
      if (messagesThisMonth >= monthlyLimit) {
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
      // 🔒 SECURITY FIX: Fail-closed on exception (block access, don't continue)
      logger.error('[MessageService] ⚠️ Exception checking usage limits:', error.message || error);
      return {
        success: false,
        error: 'USAGE_VERIFICATION_FAILED',
        message: 'Unable to verify message limits. Please try again in a moment.',
        technical: error.message
      };
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
        logger.debug("✅ [MessageService] Created conversation:", convId);
      }
    } catch (err) {
      logger.error('[MessageService] Error creating conversation:', err.message || err);
    }
  } else if (convId && userId) {
    // ✅ Update generic titles with tier-based logic
    try {
      const { data: existing } = await getSupabase()
        .from("conversations")
        .select("title")
        .eq("id", convId)
        .single();
      
      const genericTitles = ["Default Conversation", "New Conversation", "Untitled", "New conversation", "Untitled conversation"];
      if (existing && genericTitles.includes(existing.title)) {
        const newTitle = await generateConversationTitle(text, tier);
        await getSupabase()
          .from("conversations")
          .update({ title: newTitle })
          .eq("id", convId);
        logger.debug(`✅ [MessageService] Updated conversation title: "${newTitle}"`);
      }
    } catch (err) {
      logger.error('[MessageService] Error updating conversation title:', err.message || err);
    }
  }

  try {
    // Extract and update memory from user message
    if (userId) {
      try {
        // Extract memory from the message
        const extractedMemory = extractMemoryFromMessage(text);
        logger.debug('🧠 [MessageService] Extracted memory:', JSON.stringify(extractedMemory));
        
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
              logger.error('[MessageService] Error updating memory:', updateError.message || updateError);
            } else {
              logger.debug('✅ [MessageService] Memory updated successfully:', JSON.stringify(mergedMemory));
            }
          }
        }
      } catch (memoryError) {
        logger.error('[MessageService] Memory extraction failed:', memoryError.message || memoryError);
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
          logger.debug('🧠 [MessageService] Retrieved user memory:', JSON.stringify(userMemory));
          
          // Add memory context if available
          if (userMemory.name) {
            personalizedContent = `[User Context: Name is ${userMemory.name}${userMemory.context ? `, Context: ${userMemory.context}` : ''}]\n\nUser message: ${text}`;
            logger.debug('🧠 [MessageService] Personalized content:', personalizedContent.substring(0, 200) + '...');
          } else {
            logger.debug('🧠 [MessageService] No user memory found for userId:', userId);
          }
        }
      } catch (error) {
        logger.warn('🧠 [MessageService] Failed to fetch user memory:', error);
      }
    }

    // Add concise Atlas system prompt
    const enhancedContent = personalizedContent + `\n\nYou are Atlas, an emotionally intelligent AI companion.

Core principles:
- Respond with empathy, clarity, and warmth
- Keep responses concise (2-3 sentences for simple questions, expand only when helpful)
- Use markdown formatting: **bold**, lists, tables when appropriate
- Use emojis sparingly (1-2 per response max) for warmth: ✨ insights, 💡 ideas, 🎯 goals, 💪 encouragement, 🤔 reflection, ❤️ support
- Keep paragraphs short (2-3 sentences max) for mobile readability
- Use proper grammar, spacing, and punctuation (e.g., "Jason! It's" not "Jason!It's")
- Be conversational, not robotic - avoid repetitive greetings

Tone: Warm, supportive, like talking to a knowledgeable friend. Respond contextually to what they're asking.

Safety: Never provide medical, legal, or crisis advice. For distress, offer empathy and direct to support resources.`;

    // 🧠 MEMORY 100%: Get conversation history for context (Core/Studio only)
    let conversationHistory = [];
    if (tier === 'core' || tier === 'studio') {
      try {
        logger.debug(`🧠 [Memory] Fetching conversation history for context...`);
        const { data: historyMessages, error: historyError } = await getSupabase()
          .from('messages')
          .select('role, content, created_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(10); // Last 10 messages for context
        
        if (historyError) {
          logger.error('[MessageService] Error fetching conversation history:', historyError.message || historyError);
        } else if (historyMessages && historyMessages.length > 0) {
          conversationHistory = historyMessages.map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'object' ? msg.content.text : msg.content
          }));
          logger.debug(`🧠 [Memory] Loaded ${conversationHistory.length} messages for context`);
        }
      } catch (error) {
        logger.error('[MessageService] Error loading conversation history:', error.message || error);
      }
    }

    // 🧠 MEMORY 100%: Build messages array with conversation history
    const messages = [];
    
    // Add conversation history (last 10 messages for context)
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
      logger.debug(`🧠 [Memory] Added ${conversationHistory.length} messages to context`);
    }
    
    // Add current user message
    messages.push({ role: 'user', content: enhancedContent });

    // Retry logic for Claude API calls
    let completion;
    let lastError;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        completion = await getAnthropic().messages.create({
          model,
          max_tokens: 2000, // ✅ FIX: Increased from 512 to allow proper responses
          messages: messages,
        });
        
        logger.debug(`✅ [MessageService] Claude API call successful on attempt ${attempt}`);
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error;
        
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!completion) {
      throw lastError || new Error('Claude API failed after 3 attempts');
    }

    const reply = completion.content[0]?.text || "(no response)";
    logger.debug("🧠 [MessageService] Claude reply:", { tier, model, reply });

    // ✅ Save both messages to Supabase (if conversation exists)
    if (convId && userId) {
      try {
        logger.debug("📝 [MessageService] Saving messages with userId:", userId);
        
        // Insert user message
        const { error: userError } = await getSupabase().from("messages").insert({
          user_id: userId,
          conversation_id: convId,
          role: "user",
          content: text
        });
        
        if (userError) {
          logger.error('[MessageService] Error saving user message:', userError.message || userError);
        } else {
          logger.debug("✅ [MessageService] Saved user message");
        }

        // Insert assistant message
        const { error: assistantError } = await getSupabase().from("messages").insert({
          user_id: userId,
          conversation_id: convId,
          role: "assistant",
          content: filterResponse(reply) // ✅ CRITICAL FIX: Filter stage directions before saving to database
        });
        
        if (assistantError) {
          logger.error('[MessageService] Error saving assistant message:', assistantError.message || assistantError);
        } else {
          logger.debug("✅ [MessageService] Saved assistant message");
        }

        if (!userError && !assistantError) {
          logger.debug("✅ [MessageService] Saved both messages to conversation:", convId);
        }
      } catch (err) {
        logger.error('[MessageService] Error saving messages to database:', err.message || err);
      }
    }

    // Update usage stats for Free tier users
    if (tier === 'free') {
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
          logger.error('[MessageService] Error updating usage stats:', updateError.message || updateError);
        } else {
          logger.debug('✅ [MessageService] Usage stats updated for Free tier user');
        }
      } catch (error) {
        logger.error('[MessageService] Error in usage stats update:', error.message || error);
      }
    }

    return { reply, model, tier, conversationId: convId };

  } catch (err) {
    return {
      reply: "⚠️ Atlas had an error contacting Claude. Please try again.",
      model,
      tier,
      conversationId: convId,
    };
  }
}
