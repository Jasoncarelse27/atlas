import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// POST /admin/resetAttempts - Delete all rows from feature_attempts table
router.post('/resetAttempts', async (req, res) => {
  try {
    const { error } = await supabase
      .from('feature_attempts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
    
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

export default router;
