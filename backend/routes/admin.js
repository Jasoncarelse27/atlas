import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// POST /admin/resetAttempts - Delete all rows from feature_attempts table
router.post('/resetAttempts', async (req, res) => {
  try {
    const { error } = await supabase
      .from('feature_attempts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      console.error('Error resetting attempts:', error);
      return res.json({ success: false, message: error.message });
    }
    
    res.json({ success: true, message: 'Feature attempts table reset' });
  } catch (error) {
    console.error('Error in resetAttempts:', error);
    res.json({ success: false, message: error.message });
  }
});

// GET /admin/featureFlags - Return all feature flags
router.get('/featureFlags', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('tier', { ascending: true });
    
    if (error) {
      console.error('Error fetching feature flags:', error);
      return res.json({ success: false, message: error.message });
    }
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in featureFlags:', error);
    res.json({ success: false, message: error.message });
  }
});

// 📊 NEW: GET /admin/metrics - Tier gate system metrics
router.get('/metrics', async (req, res) => {
  try {
    const { adminDashboardService } = await import('../services/adminDashboardService.mjs');
    
    const metrics = await adminDashboardService.getMetrics();
    
    res.json({
      success: true,
      metrics,
      generatedAt: new Date().toISOString(),
      system: 'Atlas Enhanced Tier Gate System'
    });

  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    res.json({ 
      success: false, 
      status: 'unavailable',
      message: 'Metrics service temporarily unavailable',
      error: error.message 
    });
  }
});

// GET /admin/verify-subscription?userId=...
router.get("/verify-subscription", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });

  try {
    // Query Supabase table where you sync subscriptions
    const { data, error } = await supabase
      .from("paddle_subscriptions")
      .select("tier,status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json({ success: false, message: "No subscription found" });

    res.json({ success: true, tier: data.tier, status: data.status });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
