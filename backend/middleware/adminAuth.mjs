// Atlas Admin Authentication Middleware
// Ensures only allowlisted admin emails can access admin endpoints

import { logger } from '../lib/simpleLogger.mjs';
import { ADMIN_EMAIL_ALLOWLIST } from '../config/adminConfig.mjs';

/**
 * Middleware to require admin access based on email allowlist
 * Expects user object to be set by upstream auth middleware
 */
export function requireAdmin(req, res, next) {
  try {
    const user = req.user; // Should come from auth middleware
    
    // Check if user exists and has email
    if (!user?.email) {
      return res.status(401).json({ 
        success: false,
        error: "UNAUTHORIZED", 
        message: "Authentication required for admin access" 
      });
    }

    const userEmail = user.email.toLowerCase();
    
    // Check if user email is in allowlist
    if (!ADMIN_EMAIL_ALLOWLIST.includes(userEmail)) {
      return res.status(403).json({ 
        success: false,
        error: "FORBIDDEN", 
        message: "Admin access not authorized for this account" 
      });
    }

    logger.debug(`✅ Admin access granted for: ${userEmail}`);
    req.isAdmin = true;
    next();
    
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      error: "INTERNAL_ERROR", 
      message: "Admin authentication failed" 
    });
  }
}

/**
 * Simplified admin check for development/testing
 * Bypasses full auth for specific scenarios
 */
export function requireAdminDev(req, res, next) {
  // Check if we're in CI environment
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  // For development or CI, we can bypass full auth if needed
  if (process.env.NODE_ENV === 'development' || isCI) {
    req.isAdmin = true;
    return next();
  }
  
  // In production, use full admin check
  return requireAdmin(req, res, next);
}

export default requireAdmin;
