// backend/middleware/tierGateMiddleware.mjs
// 🔒 SECURITY: Never trust client-sent tier. Always fetch from database.
import { logger } from '../lib/simpleLogger.mjs';
import { TIER_DEFINITIONS, selectOptimalModel } from '../config/intelligentTierSystem.mjs';
import { getUserTierSafe } from '../services/tierService.mjs';

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

    // ✅ CRITICAL: Use centralized tierService (single source of truth with normalization)
    let tier = await getUserTierSafe(user.id);

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
    
    // ✅ Select optimal model based on tier, message length, and complexity
    // selectOptimalModel now handles smart routing internally (simple queries → Haiku)
    // This is cleaner and more maintainable than overriding here
    const selectedModel = selectOptimalModel(tier, messageContent, requestType);
    
    // ✅ Use the model selected by selectOptimalModel (includes smart routing)
    req.selectedModel = selectedModel;
    
    logger.debug(`✅ [TierGate] User ${user.id} authenticated with tier: ${tier}, model: ${selectedModel}, messageLength: ${messageLength}`);
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