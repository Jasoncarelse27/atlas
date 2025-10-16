// backend/middleware/tierGateMiddleware.mjs
// 🔒 SECURITY: Never trust client-sent tier. Always fetch from database.
import { TIER_DEFINITIONS } from '../config/intelligentTierSystem.mjs';
import { supabase } from '../lib/supabase.js';

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
        console.error(`[TierGate] Failed to fetch tier for user ${user.id}:`, error.message);
        // Fail closed: Use free tier if we can't verify
        tier = 'free';
      } else {
        tier = profile?.subscription_tier || 'free';
      }
    } catch (dbError) {
      console.error(`[TierGate] Database error for user ${user.id}:`, dbError.message);
      // Fail closed: Use free tier on error
      tier = 'free';
    }

    // ✅ Validate tier against known configurations
    const tierConfig = TIER_DEFINITIONS[tier];
    if (!tierConfig) {
      console.error(`[TierGate] Invalid tier configuration: ${tier}`);
      // Fallback to free tier if invalid
      tier = 'free';
      req.tier = tier;
      req.selectedModel = TIER_DEFINITIONS.free.model;
      req.tierConfig = TIER_DEFINITIONS.free;
    } else {
      // Set the server-validated tier and model
      req.tier = tier;
      req.selectedModel = tierConfig.model;
      req.tierConfig = tierConfig;
    }
    
    console.log(`✅ [TierGate] User ${user.id} authenticated with tier: ${tier}, model: ${req.selectedModel}`);
    next();
  } catch (error) {
    console.error('[TierGate] Unexpected error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      code: 'TIER_VERIFICATION_FAILED'
    });
  }
}