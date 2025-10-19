const { logger } = require('./logger.mjs');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase;

// 🔒 SECURITY FIX: Removed mock Supabase client - ALWAYS require real credentials
// This prevents authentication bypass and ensures proper database security in all environments
if (!supabaseUrl || !supabaseServiceRoleKey) {
  logger.error('❌ FATAL: Missing Supabase credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
  logger.error('Please set environment variables before starting the server.');
  process.exit(1);
}

supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: true, persistSession: false }
});

export { supabase };
