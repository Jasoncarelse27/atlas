// backend/middleware/authMiddleware.mjs
import jwt from "jsonwebtoken";

export default async function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing token" });

  try {
    const decoded = jwt.decode(token) || {};
    const userId = decoded?.sub || decoded?.user_id || decoded?.user?.id;
    if (!userId) return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });

    // Fetch user profile to get tier information
    let tier = 'free'; // Default fallback
    
    try {
      const { supabase } = await import('../config/supabaseClient.mjs');
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.warn('[authMiddleware] Could not fetch user profile:', error.message);
        // Try to create profile if it doesn't exist
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: decoded?.email,
            subscription_tier: 'free'
          });
        
        if (insertError) {
          console.warn('[authMiddleware] Could not create user profile:', insertError.message);
        }
      } else {
        tier = profile?.subscription_tier || 'free';
      }
    } catch (profileError) {
      console.warn('[authMiddleware] Error fetching user profile:', profileError.message);
    }

    req.user = { 
      id: userId, 
      email: decoded?.email,
      tier: tier
    };
    req.auth = { user: req.user, raw: decoded };
    
    // Also set req.tier for middleware compatibility
    req.tier = tier;
    
    next();
  } catch (e) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Bad token" });
  }
}