#!/bin/bash
echo "🧹 Atlas Console Cleanup Script"
echo "════════════════════════════════════════════════════════════════"

# Count before cleanup
BEFORE=$(grep -r "console\.\(log\|warn\|error\|debug\)" src backend --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" 2>/dev/null | wc -l | xargs)

echo "📊 Found $BEFORE console statements"
echo ""
echo "🔍 Analyzing which to keep (🚨🧠✅) vs remove..."

# Count critical logs that will be kept
CRITICAL=$(grep -r "console\.\(log\|warn\|error\|debug\)" src backend --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" 2>/dev/null | grep -E "🚨|🧠|✅" | wc -l | xargs)

echo "✅ Keeping $CRITICAL critical health/security logs"
echo "🗑️  Removing ~$((BEFORE - CRITICAL)) noisy dev logs"
echo ""

read -p "Continue with cleanup? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

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
echo "   Removed: $((BEFORE - AFTER)) statements"
echo ""
echo "💾 Backups saved as *.bak files"
echo "🧪 Test your app, then run: find src backend -name '*.bak' -delete"
echo ""
echo "🚀 Restart Atlas with: ./start.sh"

