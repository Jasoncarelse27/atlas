// backend/middleware/tierGateMiddleware.mjs
// 🔒 SECURITY: Never trust client-sent tier. Always fetch from database.
import { logger } from '../lib/simpleLogger.mjs';
import { TIER_DEFINITIONS, selectOptimalModel } from '../config/intelligentTierSystem.mjs';
import { supabase } from '../config/supabaseClient.mjs';

/**
 * Middleware to select the appropriate AI model based on user tier
 * and enforce tier-specific features and limits.
 * 
 * ⚠️ CRITICAL: This middleware fetches the tier from the database
 * and NEVER trusts the client-provided tier in the request body.
 */
export default async function tierGateMiddleware(req, res, next) {
  try {
    // ✅ SECURITY: Get tier from authenticated user (set by authMiddleware)
    const { user } = req;
    
    if (!user || !user.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // ✅ SECURITY: Always fetch tier from database (single source of truth)
    let tier = 'free'; // Default to free tier
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();
      
      if (error) {
        logger.error(`[TierGate] Failed to fetch tier for user ${user.id}:`, error.message);
        // Fail closed: Use free tier if we can't verify
        tier = 'free';
      } else {
        tier = profile?.subscription_tier || 'free';
      }
    } catch (dbError) {
      logger.error(`[TierGate] Database error for user ${user.id}:`, dbError.message);
      // Fail closed: Use free tier on error
      tier = 'free';
    }

    // ✅ Validate tier against known configurations
    const tierConfig = TIER_DEFINITIONS[tier];
    if (!tierConfig) {
      logger.error(`[TierGate] Invalid tier configuration: ${tier}`);
      // Fallback to free tier if invalid
      tier = 'free';
      req.tier = tier;
      req.tierConfig = TIER_DEFINITIONS.free;
    } else {
      // Set the server-validated tier
      req.tier = tier;
      req.tierConfig = tierConfig;
    }
    
    // ✅ COST OPTIMIZATION: Message length-based model routing
    // Short messages (<1k chars) → Haiku (cost-effective)
    // Longer messages → Tier-appropriate model (Sonnet/Opus)
    const messageContent = req.body?.message || req.body?.text || '';
    const messageLength = messageContent.length;
    const requestType = req.path.includes('image') ? 'image_analysis' : 
                       req.path.includes('file') ? 'file_analysis' : 
                       'chat';
    
    // Select optimal model based on tier and message length
    const selectedModel = selectOptimalModel(tier, messageContent, requestType);
    
    // ✅ COST CONTROL: Override to Haiku for short messages (<1k chars) regardless of tier
    // This saves costs while maintaining quality for simple queries
    const finalModel = messageLength > 0 && messageLength < 1000 
      ? 'claude-3-haiku-20240307' 
      : selectedModel;
    
    req.selectedModel = finalModel;
    
    logger.debug(`✅ [TierGate] User ${user.id} authenticated with tier: ${tier}, model: ${finalModel}, messageLength: ${messageLength}`);
    next();
  } catch (error) {
    logger.error('[TierGate] Unexpected error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      code: 'TIER_VERIFICATION_FAILED'
    });
  }
}