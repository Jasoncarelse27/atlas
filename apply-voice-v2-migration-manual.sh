#!/bin/bash
# Apply Voice V2 Sessions Migration to Supabase
# Instructions for manual application via Supabase Dashboard

echo "📋 Voice V2 Sessions Migration - Manual Application Guide"
echo ""
echo "Migration file: supabase/migrations/20251027_voice_v2_sessions.sql"
echo ""
echo "🔗 Steps to apply:"
echo ""
echo "1. Open Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/sql/new"
echo ""
echo "2. Copy the SQL from:"
echo "   supabase/migrations/20251027_voice_v2_sessions.sql"
echo ""
echo "3. Paste into SQL Editor"
echo ""
echo "4. Click 'Run' to execute"
echo ""
echo "5. Verify table created:"
echo "   https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/editor"
echo ""
echo "✅ Expected result:"
echo "   - voice_sessions table created"
echo "   - 7 indexes created"
echo "   - 4 RLS policies created"
echo "   - Permissions granted"
echo ""
echo "📄 Opening migration file..."
cat supabase/migrations/20251027_voice_v2_sessions.sql

