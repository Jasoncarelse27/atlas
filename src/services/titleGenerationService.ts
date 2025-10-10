/**
 * 🎯 Atlas Conversation Title Generation Service
 * 
 * Tier-based title generation:
 * - FREE: First 40 chars (instant, no cost)
 * - CORE: Smart extraction with basic cleanup
 * - STUDIO: AI-generated concise titles (premium)
 * 
 * 100% reliable with fallbacks at every step
 */

import { supabase } from '../lib/supabaseClient';

export type UserTier = 'free' | 'core' | 'studio';

interface TitleGenerationOptions {
  message: string;
  tier: UserTier;
  conversationId?: string;
  userId?: string;
}

/**
 * Generate conversation title based on tier
 * Guaranteed to return a title (never fails)
 */
export async function generateConversationTitle(options: TitleGenerationOptions): Promise<string> {
  const { message, tier } = options;
  
  // ✅ Safety: Ensure message exists
  if (!message || message.trim().length === 0) {
    return generateFallbackTitle();
  }
  
  try {
    switch (tier) {
      case 'free':
        return generateFreeTierTitle(message);
      
      case 'core':
        return generateCoreTierTitle(message);
      
      case 'studio':
        return await generateStudioTierTitle(message);
      
      default:
        return generateFreeTierTitle(message);
    }
  } catch (error) {
    console.error('[TitleGen] ❌ Title generation failed:', error);
    // ✅ Always fallback to basic title
    return generateFreeTierTitle(message);
  }
}

/**
 * FREE TIER: First 40 chars (instant, no API calls)
 */
function generateFreeTierTitle(message: string): string {
  const cleaned = message.trim();
  
  if (cleaned.length <= 40) {
    return cleaned;
  }
  
  // Try to find a natural break point (word boundary)
  const truncated = cleaned.substring(0, 40);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > 20) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }
  
  return truncated + '...';
}

/**
 * CORE TIER: Smart extraction with cleanup
 * Removes common prefixes, questions marks, etc.
 */
function generateCoreTierTitle(message: string): string {
  let title = message.trim();
  
  // Remove common question words if too long
  if (title.length > 50) {
    title = title
      .replace(/^(can you|could you|would you|will you|please|hey|hi|hello)/gi, '')
      .trim();
  }
  
  // Remove multiple spaces
  title = title.replace(/\s+/g, ' ');
  
  // Limit to 50 chars with smart truncation
  if (title.length > 50) {
    // Try to find a good break point (sentence end, comma, etc)
    const breakPoints = ['. ', '? ', '! ', ', ', '; '];
    
    for (const breakPoint of breakPoints) {
      const index = title.indexOf(breakPoint);
      if (index > 20 && index <= 50) {
        return title.substring(0, index + 1).trim();
      }
    }
    
    // Find word boundary
    const truncated = title.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > 30) {
      return truncated.substring(0, lastSpace);
    }
    
    return truncated + '...';
  }
  
  return title;
}

/**
 * STUDIO TIER: AI-generated title using backend
 * Falls back to CORE logic if API fails
 */
async function generateStudioTierTitle(message: string): Promise<string> {
  try {
    // ✅ Call backend to generate AI title
    const { data, error } = await supabase.functions.invoke('generate-title', {
      body: { message: message.substring(0, 200) } // Limit input to reduce cost
    });
    
    if (error) {
      console.warn('[TitleGen] ⚠️ Studio API failed, using Core fallback:', error.message);
      return generateCoreTierTitle(message);
    }
    
    if (data?.title && typeof data.title === 'string') {
      // Ensure AI title is reasonable length
      const aiTitle = data.title.trim();
      if (aiTitle.length > 0 && aiTitle.length <= 60) {
        return aiTitle;
      }
    }
    
    // If AI returns invalid title, fallback
    return generateCoreTierTitle(message);
    
  } catch (error) {
    console.warn('[TitleGen] ⚠️ Studio generation failed, using Core fallback');
    return generateCoreTierTitle(message);
  }
}

/**
 * Generate fallback title when all else fails
 */
function generateFallbackTitle(): string {
  const timestamp = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  return `Chat ${timestamp}`;
}

/**
 * Update conversation title in database
 * Safe to call multiple times (idempotent)
 */
export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string
): Promise<boolean> {
  try {
    // ✅ First, check if conversation needs title update
    const { data: existing } = await supabase
      .from('conversations')
      .select('title')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single() as { data: { title: string } | null; error: any };
    
    // Skip if already has a good title
    const genericTitles = [
      'New Conversation',
      'Default Conversation',
      'Untitled',
      'New conversation',
      'Chat'
    ];
    
    if (existing && !genericTitles.some(generic => existing.title?.startsWith(generic))) {
      console.log('[TitleGen] ✅ Conversation already has title:', existing.title);
      return true;
    }
    
    // ✅ Update with new title
    const { error } = await supabase
      .from('conversations')
      .update({ 
        title,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', conversationId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('[TitleGen] ❌ Failed to update title:', error);
      return false;
    }
    
    console.log('[TitleGen] ✅ Updated conversation title:', title);
    return true;
    
  } catch (error) {
    console.error('[TitleGen] ❌ Update title error:', error);
    return false;
  }
}

/**
 * Auto-generate and update title for conversation
 * Call this after first user message
 */
export async function autoGenerateTitle(options: TitleGenerationOptions): Promise<string> {
  const { conversationId, userId, message, tier } = options;
  
  // Generate title
  const title = await generateConversationTitle({ message, tier });
  
  // Update in database if we have conversation ID
  if (conversationId && userId) {
    await updateConversationTitle(conversationId, userId, title);
  }
  
  return title;
}

