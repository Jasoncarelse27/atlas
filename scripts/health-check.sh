#!/bin/bash
# Complete Atlas Health Check - All Features

echo "🔍 ATLAS COMPLETE HEALTH CHECK"
echo "================================"

# 1. Check servers running
echo -e "\n1️⃣ Servers:"
curl -k -s https://localhost:8000/healthz | jq -r 'if .status == "ok" then "✅ Backend HTTPS" else "❌ Backend" end' 2>/dev/null || echo "❌ Backend down"
curl -k -s https://localhost:5174/ -o /dev/null && echo "✅ Frontend HTTPS" || echo "❌ Frontend down"

# 2. Check database connection (via backend)
echo -e "\n2️⃣ Database:"
curl -k -s https://localhost:8000/healthz | jq -r 'if .redis == true then "✅ Redis connected" else "❌ Redis down" end' 2>/dev/null

# 3. Check recent ritual logs in database
echo -e "\n3️⃣ Rituals:"
echo "Recent ritual completions:"
RECENT_RITUALS=$(node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
supabase.from('ritual_logs').select('id,completed_at').order('completed_at', {ascending: false}).limit(3).then(({data}) => {
  if (data && data.length > 0) {
    console.log('✅ Found', data.length, 'recent logs');
    data.forEach(r => console.log('  -', new Date(r.completed_at).toLocaleString()));
  } else {
    console.log('⚠️  No ritual logs yet');
  }
}).catch(e => console.log('❌ Error:', e.message));
" 2>&1)
echo "$RECENT_RITUALS"

# 4. Check conversation history
echo -e "\n4️⃣ Chat History:"
MESSAGE_COUNT=$(node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
supabase.from('messages').select('id', {count: 'exact', head: true}).then(({count}) => {
  console.log('✅ Total messages:', count || 0);
}).catch(e => console.log('❌ Error:', e.message));
" 2>&1)
echo "$MESSAGE_COUNT"

# 5. Check SSL certificates
echo -e "\n5️⃣ SSL Certificates:"
if [ -f "localhost+1.pem" ]; then
  CERT_EXPIRY=$(openssl x509 -enddate -noout -in localhost+1.pem 2>/dev/null | cut -d= -f2)
  echo "✅ Cert valid until: $CERT_EXPIRY"
  openssl x509 -text -noout -in localhost+1.pem 2>/dev/null | grep -A1 "Subject Alternative Name" | grep "DNS\|IP" | head -1
else
  echo "❌ No SSL certificates found"
fi

# 6. Test API endpoint
echo -e "\n6️⃣ API Test:"
curl -k -s -w "\nStatus: %{http_code}\n" https://localhost:8000/healthz | head -1

echo -e "\n================================"
echo "✅ Health check complete!"
echo ""
echo "📱 Mobile: https://192.168.0.10:5174"
echo "💻 Desktop: https://localhost:5174"

