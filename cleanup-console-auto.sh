#!/bin/bash
echo "🧹 Atlas Console Cleanup Script (Auto Mode)"
echo "════════════════════════════════════════════════════════════════"

# Count before cleanup
BEFORE=$(grep -r "console\.\(log\|warn\|error\|debug\)" src backend --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" 2>/dev/null | wc -l | xargs)

echo "📊 Found $BEFORE console statements"
echo ""

# Count critical logs that will be kept
CRITICAL=$(grep -r "console\.\(log\|warn\|error\|debug\)" src backend --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" 2>/dev/null | grep -E "🚨|🧠|✅" | wc -l | xargs)

echo "✅ Keeping $CRITICAL critical health/security logs"
echo "🗑️  Removing ~$((BEFORE - CRITICAL)) noisy dev logs"
echo ""
echo "🔧 Creating backups and cleaning..."

# Find all TypeScript/JavaScript files and clean them
find src backend -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.mjs" \) | while read file; do
    # Create backup
    cp "$file" "$file.bak"
    
    # Remove console statements that don't contain critical emojis
    # Use perl for better regex support on macOS
    perl -i -ne 'print unless /console\.(log|warn|error|debug)\(/ && !/🚨/ && !/🧠/ && !/✅/' "$file"
done

# Count after cleanup
AFTER=$(grep -r "console\.\(log\|warn\|error\|debug\)" src backend --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" 2>/dev/null | wc -l | xargs)

echo ""
echo "✅ Console cleanup complete!"
echo "📊 Results:"
echo "   Before: $BEFORE statements"
echo "   After:  $AFTER statements"
echo "   Removed: $((BEFORE - AFTER)) statements (~$((100 * (BEFORE - AFTER) / BEFORE))% reduction)"
echo ""
echo "💾 Backups saved as *.bak files"
echo "🧪 Test your app thoroughly!"
echo "🗑️  If all looks good, remove backups: find src backend -name '*.bak' -delete"
echo ""
echo "🚀 Restart Atlas with: ./start.sh"

