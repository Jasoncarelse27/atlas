// Atlas Admin Authentication Middleware
// Ensures only allowlisted admin emails can access admin endpoints

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
      console.warn('🚫 Admin access denied: No user or email found');
      return res.status(401).json({ 
        success: false,
        error: "UNAUTHORIZED", 
        message: "Authentication required for admin access" 
      });
    }

    const userEmail = user.email.toLowerCase();
    
    // Check if user email is in allowlist
    if (!ADMIN_EMAIL_ALLOWLIST.includes(userEmail)) {
      console.warn(`🚫 Admin access denied for email: ${userEmail}`);
      return res.status(403).json({ 
        success: false,
        error: "FORBIDDEN", 
        message: "Admin access not authorized for this account" 
      });
    }

    console.log(`✅ Admin access granted for: ${userEmail}`);
    req.isAdmin = true;
    next();
    
  } catch (error) {
    console.error('❌ Admin auth middleware error:', error);
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
  // For development, we can bypass full auth if needed
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Development mode: Admin access granted');
    req.isAdmin = true;
    return next();
  }
  
  // In production, use full admin check
  return requireAdmin(req, res, next);
}

export default requireAdmin;
