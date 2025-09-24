import express from 'express';
import { supabase } from '../config/supabaseClient.mjs';
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

// GET /admin/usage - Get usage statistics (admin endpoint)
router.get("/usage", async (req, res) => {
  try {
    // In admin context, get userId from query parameter or use a default for testing
    const userId = req.query.userId || '65fcb50a-d67d-453e-a405-50c6aef959be'; // Default to your user ID for testing
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "userId parameter required for admin usage endpoint" 
      });
    }

    // Get user's tier from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
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
    const { email, tier, from, to, startDate, endDate } = req.query;
    
    // Handle both old (from/to) and new (startDate/endDate) parameters
    const dateFrom = startDate || from;
    const dateTo = endDate || to;
    
    // Default to last 30 days if no date range provided
    const defaultEndDate = new Date().toISOString().split('T')[0];
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
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
    
    if (dateFrom || defaultStartDate) {
      query = query.gte('snapshot_date', dateFrom || defaultStartDate);
    }
    
    if (dateTo || defaultEndDate) {
      query = query.lte('snapshot_date', dateTo || defaultEndDate);
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

// 📊 NEW: POST /admin/reports/weekly/run - Manually trigger weekly report
router.post('/reports/weekly/run', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const { generateWeeklyReport } = await import('../services/weeklyReportService.mjs');
    const result = await generateWeeklyReport(startDate, endDate);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Weekly report generated successfully',
        ...result,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to generate weekly report',
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Error in manual weekly report endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger weekly report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 📊 NEW: GET /admin/subscriptions/overview - Subscription overview with analytics
router.get('/subscriptions/overview', async (req, res) => {
  try {
    // For now, get basic subscription data from profiles table
    // TODO: Implement full subscription_audit table for detailed analytics
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('email, subscription_tier, created_at, updated_at')
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('[AdminSubs] DB error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'DB query failed',
        message: error.message 
      });
    }
    
    // Transform data to match expected format
    const overview = (profiles || []).map(profile => ({
      email: profile.email,
      current_tier: profile.subscription_tier,
      activations: 0, // TODO: Implement with subscription_audit table
      cancellations: 0, // TODO: Implement with subscription_audit table
      upgrades: 0, // TODO: Implement with subscription_audit table
      downgrades: 0, // TODO: Implement with subscription_audit table
      last_change: profile.updated_at
    }));
    
    res.json({ 
      success: true,
      overview: overview,
      timestamp: new Date().toISOString(),
      note: 'Basic subscription data - full analytics require subscription_audit table'
    });
    
  } catch (error) {
    console.error('Error in subscription overview endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch subscription overview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 📊 NEW: GET /admin/analytics/summary - Analytics data for dashboard
router.get('/analytics/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days
    const defaultEndDate = new Date().toISOString().split('T')[0];
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const dateFrom = startDate || defaultStartDate;
    const dateTo = endDate || defaultEndDate;
    
    // Get messages by day and tier
    const { data: messagesByDay, error: messagesError } = await supabase
      .from('tier_usage_snapshots')
      .select('snapshot_date, tier, message_count')
      .gte('snapshot_date', dateFrom)
      .lte('snapshot_date', dateTo)
      .order('snapshot_date');
    
    if (messagesError) throw messagesError;
    
    // Get spend by day and tier
    const { data: spendByDay, error: spendError } = await supabase
      .from('tier_usage_snapshots')
      .select('snapshot_date, tier, cost_accumulated')
      .gte('snapshot_date', dateFrom)
      .lte('snapshot_date', dateTo)
      .order('snapshot_date');
    
    if (spendError) throw spendError;
    
    // Get cache stats
    const { data: cacheByDay, error: cacheError } = await supabase
      .from('cache_stats')
      .select('date, hits, misses')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date');
    
    if (cacheError) throw cacheError;
    
    // Get tier counts
    const { data: tierCounts, error: tierError } = await supabase
      .from('tier_usage_snapshots')
      .select('tier')
      .eq('snapshot_date', dateTo);
    
    if (tierError) throw tierError;
    
    // Process data for charts
    const processedData = {
      messagesByDay: processTimeSeriesData(messagesByDay, 'message_count'),
      spendByDay: processTimeSeriesData(spendByDay, 'cost_accumulated'),
      cacheByDay: (cacheByDay || []).map(row => ({
        date: row.date,
        hits: row.hits || 0,
        misses: row.misses || 0,
        hitRate: row.hits && row.misses ? (row.hits / (row.hits + row.misses)) * 100 : 0
      })),
      tierCounts: processTierCounts(tierCounts || [])
    };
    
    res.json({
      success: true,
      data: processedData,
      dateRange: { startDate: dateFrom, endDate: dateTo },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to process time series data
function processTimeSeriesData(data, valueField) {
  const grouped = {};
  
  data.forEach(row => {
    const date = row.snapshot_date;
    if (!grouped[date]) {
      grouped[date] = { date, free: 0, core: 0, studio: 0 };
    }
    grouped[date][row.tier] += row[valueField] || 0;
  });
  
  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

// Helper function to process tier counts
function processTierCounts(data) {
  const counts = { free: 0, core: 0, studio: 0 };
  
  data.forEach(row => {
    counts[row.tier] = (counts[row.tier] || 0) + 1;
  });
  
  return Object.entries(counts).map(([tier, users]) => ({ tier, users }));
}

export default router;
