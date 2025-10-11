// backend/middleware/authMiddleware.mjs

export default async function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing or invalid authorization header" });

  try {
    // Verify the Supabase JWT token
    const { supabasePublic } = await import('../config/supabaseClient.mjs');
    const { data: { user }, error: authError } = await supabasePublic.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
    }

    const userId = user.id;
    if (!userId) return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid user ID" });

    // Fetch user profile to get tier information
    let tier = 'free'; // Default fallback
    
    try {
      const { supabase } = await import('../config/supabaseClient.mjs');
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      
      if (error) {
        // Try to create profile if it doesn't exist
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: user.email,
            subscription_tier: 'free'
          });
        
        if (insertError) {
          console.log('Profile insert error:', insertError.message);
        }
      } else {
        tier = profile?.subscription_tier || 'free';
      }
    } catch (profileError) {
      console.log('Profile error:', profileError.message);
    }

    req.user = { 
      id: userId, 
      email: user.email,
      tier: tier
    };
    req.auth = { user: req.user, raw: user };
    
    // Also set req.tier for middleware compatibility
    req.tier = tier;
    
    next();
  } catch (e) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Bad token" });
  }
}