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
  core: "claude-sonnet-4-5-20250929",  // ✅ FIXED: Updated from claude-3-sonnet-20240229 (returns 404)
  studio: "claude-sonnet-4-5-20250929"   // ✅ FIXED: Updated from claude-3-opus-20240229 (returns 404)
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
// ✅ GRAMMAR FIX: Ensure proper spacing after punctuation marks AND between words
function fixPunctuationSpacing(text) {
  if (!text) return text;
  
  let fixed = text;
  
  // ✅ STEP 1: Fix missing spaces after punctuation marks
  // Fix spacing after exclamation marks, question marks, periods, colons, semicolons
  fixed = fixed.replace(/([!?.])([A-Za-z])/g, '$1 $2');
  
  // Fix spacing after commas (but preserve numbers like "1,000")
  fixed = fixed.replace(/(,)([A-Za-z])/g, '$1 $2');
  
  // Fix spacing after colons and semicolons
  fixed = fixed.replace(/([:;])([A-Za-z])/g, '$1 $2');
  
  // ✅ STEP 2: Fix missing spaces between words (common patterns)
  // Fix: lowercase letter followed by uppercase letter (e.g., "Iremember" → "I remember")
  fixed = fixed.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // ✅ STEP 3: Fix missing spaces after punctuation (more comprehensive)
  // Fix: word + punctuation + letter (catches "now.I", "be.Asyour", "anything.I'm")
  fixed = fixed.replace(/([a-z])([!?.])([A-Za-z])/g, '$1$2 $3');
  
  // Fix: punctuation + any non-space character + letter (catches "you.✨ Inthe", "you.💪 Inthe")
  // This handles emojis and other characters between punctuation and letters
  fixed = fixed.replace(/([!?.])([^\s])([A-Za-z])/g, '$1$2 $3');
  
  // Fix: word + number (catches "Even10-15" → "Even 10-15")
  fixed = fixed.replace(/([a-z])([0-9])/g, '$1 $2');
  
  // Fix: number + word (catches "10-15minutes" → "10-15 minutes")
  fixed = fixed.replace(/([0-9])([a-z])/g, '$1 $2');
  
  // ✅ STEP 4: Fix specific common concatenations
  // Fix common words that get concatenated incorrectly
  const commonFixes = [
    { from: /Iremember/gi, to: 'I remember' },
    { from: /adance/gi, to: 'a dance' },
    { from: /Asyour/gi, to: 'As your' },
    { from: /Sinceyou/gi, to: 'Since you' },
    { from: /puttogether/gi, to: 'put together' },
    { from: /manydays/gi, to: 'many days' },
    { from: /Withthose/gi, to: 'With those' },
    { from: /Foryou/gi, to: 'For you' },
    { from: /Toyou/gi, to: 'To you' },
    { from: /Inyour/gi, to: 'In your' },
    { from: /Onyour/gi, to: 'On your' },
    { from: /Inthe/gi, to: 'In the' },
    { from: /Howmany/gi, to: 'How many' },
    { from: /Howdoes/gi, to: 'How does' },
    { from: /Howare/gi, to: 'How are' },
    { from: /Whatare/gi, to: 'What are' },
    { from: /Whereare/gi, to: 'Where are' },
    { from: /Whenare/gi, to: 'When are' },
    { from: /Whyare/gi, to: 'Why are' },
    { from: /Doyou/gi, to: 'Do you' },
    { from: /Areyou/gi, to: 'Are you' },
    { from: /Canyou/gi, to: 'Can you' },
    { from: /Willyou/gi, to: 'Will you' },
    { from: /Wouldyou/gi, to: 'Would you' },
    { from: /Shouldyou/gi, to: 'Should you' },
    { from: /Haveyou/gi, to: 'Have you' },
    { from: /Hasyou/gi, to: 'Has you' },
    { from: /Pleaselet/gi, to: 'Please let' },
    { from: /Iam/gi, to: 'I am' },
    { from: /Ihave/gi, to: 'I have' },
    { from: /Iwill/gi, to: 'I will' },
    { from: /Ican/gi, to: 'I can' },
    { from: /Ido/gi, to: 'I do' },
    { from: /Idid/gi, to: 'I did' },
    { from: /Iwas/gi, to: 'I was' },
    { from: /Iwere/gi, to: 'I were' },
  ];
  
  for (const { from, to } of commonFixes) {
    fixed = fixed.replace(from, to);
  }
  
  // ✅ STEP 5: Collapse multiple spaces back to single space
  fixed = fixed.replace(/\s{2,}/g, ' ');
  
  // ✅ STEP 6: Trim and clean up
  fixed = fixed.trim();
  
  return fixed;
}

// 🔒 BRANDING FILTER: Rewrite any mentions of Claude/Anthropic to maintain Atlas identity
// 🎭 STAGE DIRECTION FILTER: Remove stage directions like "*speaks in a friendly voice*"
// ✅ GRAMMAR FIX: Fix spacing after punctuation marks
function filterResponse(text) {
  if (!text) return text;
  
  // Case-insensitive replacements
  let filtered = text;
  
  // ✅ CRITICAL FIX: Remove stage directions (text in asterisks OR square brackets)
  // Examples: "*speaks in a friendly voice*", "*responds warmly*", "[In a clear, conversational voice]", "*clears voice*", "*clears throat*"
  // This prevents stage directions from appearing in transcripts or being spoken
  filtered = filtered.replace(/\*[^*]+\*/g, ''); // Remove text between asterisks (includes "*clears voice*", "*clears throat*")
  filtered = filtered.replace(/\[[^\]]+\]/g, ''); // Remove text between square brackets
  
  // ✅ GRAMMAR FIX: Fix spacing after punctuation marks BEFORE collapsing spaces
  filtered = fixPunctuationSpacing(filtered);
  
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
  
  // ✅ SECURITY: Validate message length (prevent abuse, protect API costs) - Tier-aware
  // Aligned with token monitoring system: ~4 characters per token
  const TIER_CHAR_LIMITS = {
    free: 2000,    // ~500 tokens (maxTokensPerResponse: 100 × 5)
    core: 4000,    // ~1000 tokens (maxTokensPerResponse: 250 × 4)
    studio: 8000,  // ~2000 tokens (maxTokensPerResponse: 400 × 5)
  };
  const maxLength = TIER_CHAR_LIMITS[tier] || TIER_CHAR_LIMITS.free;
  if (text && text.length > maxLength) {
    logger.warn(`[MessageService] Message too long for ${tier} tier: ${text.length} chars (max: ${maxLength})`);
    return {
      success: false,
      error: 'MESSAGE_TOO_LONG',
      message: `Message exceeds ${maxLength.toLocaleString()} character limit for ${tier} tier.`,
      maxLength,
      currentLength: text.length
    };
  }
  
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
    const enhancedContent = personalizedContent + `\n\nYou are Atlas, an emotionally intelligent AI companion designed to bridge emotional awareness with productive action.

🎯 CORE IDENTITY:
- You're not just empathetic OR productive - you're BOTH
- Your unique value: Convert emotions into actionable steps
- Think: "How can I help them understand their feeling AND take action?"

💬 CONVERSATION PRINCIPLES:

1. NATURAL FLOW (Not Robotic):
   - Use contractions naturally: "I'm", "you're", "let's", "that's"
   - Vary your responses - don't repeat the same phrases
   - Match their energy: If they're excited, be enthusiastic. If they're stressed, be calm and supportive
   - Skip unnecessary greetings: If you already know them, jump straight to helping
   - Example GOOD: "I remember you mentioned dance - how's that going? What do you need help with today?"
   - Example BAD: "Hello! It's great to hear from you again. I remember you mentioned dance. How can I help you today?"

2. PROACTIVE HELPFULNESS:
   - Don't just answer - anticipate what they might need next
   - After answering, offer: "Would it help if I [suggested next step]?" or "I can also help with [related thing]"
   - Example: User asks about dance timetable → Answer + "Want me to create a sample schedule, or do you have specific days in mind?"

3. CONTEXT AWARENESS:
   - Reference previous conversations naturally: "Last time we talked about [topic]..."
   - Build on what you know: "Since you're into [their interest], here's how that applies..."
   - Connect dots: "This relates to what you mentioned about [previous topic]..."

4. EMOTION → ACTION FRAMEWORK (Your Unique Strength):
   When users express emotions (stressed, overwhelmed, anxious, stuck, excited, motivated):
   
   STEP 1: Acknowledge the emotion with empathy
   STEP 2: Help them understand WHY they feel this way (root cause)
   STEP 3: Provide SPECIFIC actionable steps (not vague advice)
   
   Use tables when helpful:
   | Feeling | Root Cause | Action Step |
   |---------|------------|-------------|
   | [emotion] | [why] | [specific step] |
   
   Example scenarios:
   - "I'm overwhelmed" → Emotion → Action table + priority list
   - "I'm stuck" → Decision clarity table + next steps
   - "I don't know where to start" → Priority list with time estimates

5. RESPONSE LENGTH (Match the Query):
   - Simple questions (1-2 sentences): Keep response brief (2-3 sentences)
   - Complex questions: Expand thoughtfully, use structure (lists, tables)
   - Emotional queries: Take time to show empathy, then provide action steps
   - Never pad responses with unnecessary words

FORMATTING GUIDELINES (CRITICAL for readability and professionalism):

Grammar & Spacing (MANDATORY - follow exactly):
- ALWAYS add a space after punctuation marks: periods (.), exclamation marks (!), question marks (?), commas (,), colons (:), semicolons (;)
- ALWAYS add a space between words - never concatenate words together
- Examples: "Jason! It's" (correct) NOT "Jason!It's" (wrong)
- Examples: "wonderfully. I remember" (correct) NOT "wonderfully. Iremember" (wrong)
- Examples: "a dance" (correct) NOT "adance" (wrong)
- Examples: "As your" (correct) NOT "Asyour" (wrong)
- Examples: "many days" (correct) NOT "manydays" (wrong)
- Examples: "With those" (correct) NOT "Withthose" (wrong)
- Examples: "I remember" (correct) NOT "Iremember" (wrong)
- Always use double line breaks (\\n\\n) to separate distinct ideas or sections
- Keep paragraphs short (2-3 sentences max) for mobile readability
- CRITICAL: Before sending your response, read it back and ensure every word is separated by a space. Never concatenate words together.

Emojis:
- Use emojis sparingly (1-2 per response max) for warmth and emphasis
- Emoji guide: ✨ insights, 💡 ideas, 🎯 goals, 💪 encouragement, 🤔 reflection, ❤️ support, 🎉 celebration, 📊 data/analysis
- Place emojis at the end of key points or sections, not in every sentence
- Never overuse emojis - they should enhance, not distract

Tables (USE WHEN ASKED TO EXPLAIN, COMPARE, OR SHOW DATA):
- When user asks to "explain in a table", "compare in a table", "show in a table", or similar requests, ALWAYS use markdown tables
- Use tables for: comparisons, options analysis, step-by-step breakdowns, data presentation, pros/cons, feature comparisons, emotion → action breakdowns
- Format tables properly with markdown: | Column 1 | Column 2 | Column 3 |
- Include clear headers and align content logically
- Example use cases: "Compare these options", "Explain the differences", "Show me a breakdown", "What are the pros and cons"

Markdown Formatting:
- Use **bold** for key terms, section headers, or important points
- Use *italics* for subtle emphasis or quotes
- Use numbered lists (1. 2. 3.) for steps, priorities, or sequential information
- Use bullet lists (- or *) for options, features, or non-sequential items
- Always add spacing between list items for readability

Tone: Warm, supportive, like talking to a knowledgeable friend who genuinely cares. Be conversational, not clinical. Show personality while staying professional.

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

    // ✅ TOKEN TRACKING: Extract and log usage for cost tracking
    let tokenUsage = { input_tokens: 0, output_tokens: 0 };
    if (completion.usage) {
      tokenUsage = {
        input_tokens: completion.usage.input_tokens || 0,
        output_tokens: completion.usage.output_tokens || 0
      };
      
      // Log to usage_logs table
      try {
        const { estimateRequestCost } = await import('../config/intelligentTierSystem.mjs');
        const cost = estimateRequestCost(model, tokenUsage.input_tokens, tokenUsage.output_tokens);
        
        const { supabase } = await import('../config/supabaseClient.mjs');
        await supabase.from('usage_logs').insert({
          user_id: userId,
          event: 'chat_message',
          tier: tier, // ✅ Explicit column (best practice)
          feature: 'chat',
          tokens_used: tokenUsage.input_tokens + tokenUsage.output_tokens,
          estimated_cost: cost,
          metadata: {
            model,
            input_tokens: tokenUsage.input_tokens,
            output_tokens: tokenUsage.output_tokens,
            message_length: reply.length
          },
          created_at: new Date().toISOString()
        }).catch(err => {
          logger.warn('[MessageService] Failed to log usage:', err.message);
        });
        
        logger.debug(`[MessageService] ✅ Logged ${tokenUsage.input_tokens + tokenUsage.output_tokens} tokens, cost: $${cost.toFixed(6)}`);
      } catch (logError) {
        logger.warn('[MessageService] Error logging token usage:', logError.message);
        // Don't fail the request if logging fails
      }
    }

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
