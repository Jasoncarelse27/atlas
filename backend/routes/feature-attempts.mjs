import { Router } from "express";
import { supabase } from "../config/supabaseClient.mjs";

const router = Router();

// POST /api/feature-attempts - Log a feature attempt
router.post("/", async (req, res) => {
  const { userId, feature } = req.body;

  // Validate required fields
  if (!userId || !feature) {
    return res.status(400).json({ 
      error: "Missing required fields: userId, feature" 
    });
  }

  // ✅ SECURITY: Fetch tier from database (never trust client-sent tier)
  let tier = 'free'; // Default
  if (req.user?.id && req.user.id === userId) {
    // If authenticated and userId matches, use verified tier from authMiddleware
    tier = req.user.tier || 'free';
  } else {
    // If not authenticated or userId mismatch, fetch tier from database
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      tier = profile?.subscription_tier || 'free';
    } catch (dbError) {
      console.debug('[FeatureAttempts] Could not fetch tier for userId:', userId);
      tier = 'free'; // Fail closed
    }
  }

  try {
    const { error } = await supabase
      .from("feature_attempts")
      .insert({
        user_id: userId,
        feature,
        tier,
      });

    if (error) {
      return res.status(500).json({ 
        error: "Failed to log feature attempt",
        details: error.message 
      });
    }

    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ 
      error: "Failed to log feature attempt",
      details: err.message 
    });
  }
});

// GET /api/feature-attempts/stats/:userId - Get user's feature attempt stats
router.get("/stats/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from("feature_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ 
        error: "Failed to fetch stats",
        details: error.message 
      });
    }

    // Group by feature for summary
    const featureCounts = data.reduce((acc, attempt) => {
      acc[attempt.feature] = (acc[attempt.feature] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalAttempts: data.length,
      featureCounts,
      attempts: data
    });
  } catch (err) {
    res.status(500).json({ 
      error: "Failed to fetch stats",
      details: err.message 
    });
  }
});

export default router;
