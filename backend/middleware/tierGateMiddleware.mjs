// backend/middleware/tierGateMiddleware.mjs
import { TIER_DEFINITIONS } from '../config/intelligentTierSystem.mjs';

/**
 * Middleware to select the appropriate AI model based on user tier
 * and enforce tier-specific features and limits.
 */
export default async function tierGateMiddleware(req, res, next) {
  try {
    const { tier } = req.body || {};
    
    if (!tier) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tier information' 
      });
    }

    const tierConfig = TIER_DEFINITIONS[tier];
    if (!tierConfig) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid tier provided' 
      });
    }

    // Set the model based on tier
    req.selectedModel = tierConfig.model;
    req.tierConfig = tierConfig;
    
    console.log(`[tierGateMiddleware] ${tier} tier: ${req.selectedModel} selected, budget: $${tierConfig.monthlyBudget || 0}/$${tierConfig.maxBudget || 0}`);
    
    next();
  } catch (error) {
    console.error('[tierGateMiddleware] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
}