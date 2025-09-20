import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAdminDev } from '../middleware/adminAuth.mjs';

const router = express.Router();

// Apply admin authentication to all routes
// Using requireAdminDev for now (bypasses in development)
router.use(requireAdminDev);

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

// GET /admin/usage - Get current user's usage statistics
router.get("/usage", async (req, res) => {
  try {
    // Get user ID from auth middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    // Get user's tier from user_profiles
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.warn('[admin/usage] Could not fetch user profile:', profileError.message);
    }

    const tier = profile?.subscription_tier || 'free';
    const today = new Date().toISOString().slice(0, 10);

    // Get today's usage count
    const { data: usageData, error: usageError } = await supabase
      .from('daily_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (usageError) {
      console.warn('[admin/usage] Could not fetch daily usage:', usageError.message);
    }

    const dailyMessagesUsed = usageData?.count || 0;
    
    // Get tier limits
    const TIER_LIMITS = {
      free: { dailyMessages: 15, monthlyBudget: 0 },
      core: { dailyMessages: -1, monthlyBudget: 20 },
      studio: { dailyMessages: -1, monthlyBudget: 200 },
    };

    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    res.json({
      success: true,
      tier,
      dailyMessagesUsed,
      dailyMessagesLimit: limits.dailyMessages,
      monthlyBudgetUsed: 0, // TODO: Implement monthly budget tracking
      monthlyBudgetLimit: limits.monthlyBudget,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[admin/usage] Error fetching usage:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch usage data" 
    });
  }
});

// 📊 NEW: GET /admin/snapshots - Tier usage snapshots with filtering
router.get('/snapshots', async (req, res) => {
  try {
    const { email, tier, from, to, page = 1, pageSize = 50 } = req.query;
    
    // Build query with filters
    let query = supabase
      .from('tier_usage_snapshots')
      .select('*', { count: 'exact' })
      .order('snapshot_date', { ascending: false })
      .order('email', { ascending: true });
    
    // Apply filters
    if (email) {
      query = query.eq('email', email);
    }
    
    if (tier) {
      query = query.eq('tier', tier);
    }
    
    if (from) {
      query = query.gte('snapshot_date', from);
    }
    
    if (to) {
      query = query.lte('snapshot_date', to);
    }
    
    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    query = query.range(offset, offset + parseInt(pageSize) - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching snapshots:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.json({
      success: true,
      snapshots: data || [],
      meta: {
        total: count || 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil((count || 0) / parseInt(pageSize))
      },
      filters: { email, tier, from, to },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in snapshots endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch snapshots',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 📊 NEW: GET /admin/trends/:email - Get usage trends for specific user
router.get('/trends/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { days = 30 } = req.query;
    
    const { data, error } = await supabase
      .rpc('get_user_usage_trend', { 
        p_email: email, 
        p_days: parseInt(days) 
      });
    
    if (error) {
      console.error('Error fetching user trends:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.json({
      success: true,
      email,
      days: parseInt(days),
      trends: data || [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in trends endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user trends',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 📊 NEW: GET /admin/summary - Get tier summary for specific date
router.get('/summary', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const { data, error } = await supabase
      .rpc('get_tier_summary', { p_date: date });
    
    if (error) {
      console.error('Error fetching tier summary:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.json({
      success: true,
      date,
      summary: data || [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in summary endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch tier summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 📊 NEW: POST /admin/snapshots/take - Manually trigger snapshot
router.post('/snapshots/take', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('take_tier_usage_snapshot');
    
    if (error) {
      console.error('Error taking snapshot:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.json({
      success: true,
      message: 'Snapshot taken successfully',
      snapshotsCreated: data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in take snapshot endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to take snapshot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 📊 NEW: GET /admin/snapshots/export.csv - Export snapshots as CSV
router.get('/snapshots/export.csv', async (req, res) => {
  try {
    const { email, tier, from, to } = req.query;
    
    // Build query with filters
    let query = supabase
      .from('tier_usage_snapshots')
      .select(`
        snapshot_date,
        email,
        tier,
        message_count,
        cost_accumulated,
        daily_limit,
        budget_ceiling,
        status,
        created_at
      `)
      .order('snapshot_date', { ascending: false })
      .order('email', { ascending: true });
    
    // Apply filters
    if (email) {
      query = query.ilike('email', `%${email}%`);
    }
    
    if (tier) {
      query = query.eq('tier', tier);
    }
    
    if (from) {
      query = query.gte('snapshot_date', from);
    }
    
    if (to) {
      query = query.lte('snapshot_date', to);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching snapshots for CSV:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    // Convert to CSV format
    const headers = [
      'snapshot_date',
      'email', 
      'tier',
      'message_count',
      'cost_accumulated',
      'daily_limit',
      'budget_ceiling',
      'status',
      'created_at'
    ];
    
    const csvRows = [
      // Header row
      headers.join(','),
      // Data rows
      ...(data || []).map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = value?.toString() || '';
          return stringValue.includes(',') || stringValue.includes('"') 
            ? `"${stringValue.replace(/"/g, '""')}"` 
            : stringValue;
        }).join(',')
      )
    ];
    
    const csv = csvRows.join('\n');
    
    // Generate filename with timestamp and filters
    const timestamp = new Date().toISOString().slice(0, 10);
    const filterSuffix = [
      email && `email-${email}`,
      tier && `tier-${tier}`,
      from && `from-${from}`,
      to && `to-${to}`
    ].filter(Boolean).join('_');
    
    const filename = `atlas_snapshots_${timestamp}${filterSuffix ? '_' + filterSuffix : ''}.csv`;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    console.log(`📊 CSV export generated: ${filename} (${data?.length || 0} rows)`);
    
    res.send(csv);
    
  } catch (error) {
    console.error('Error in CSV export endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export CSV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
