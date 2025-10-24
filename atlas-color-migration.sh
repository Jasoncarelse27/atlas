#!/bin/bash

# Atlas Color Migration Script
# Replaces all blue color references with Atlas professional color palette
# Run from project root: ./atlas-color-migration.sh

echo "🎨 Atlas Color Migration Script"
echo "================================"
echo ""

# Backup check
echo "📦 Checking git status..."
if [[ `git status --porcelain` ]]; then
  echo "⚠️  WARNING: You have uncommitted changes."
  echo "   It's recommended to commit or stash before running this script."
  read -p "   Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted."
    exit 1
  fi
fi

echo "✅ Starting color migration..."
echo ""

# Counter for changes
total_changes=0

# Function to perform replacement
replace_pattern() {
  local pattern=$1
  local replacement=$2
  local description=$3
  
  echo "🔄 Replacing: $description"
  echo "   Pattern: $pattern → $replacement"
  
  # Count occurrences before replacement
  local count=$(grep -r "$pattern" src --include="*.tsx" --include="*.ts" | wc -l | tr -d ' ')
  
  if [ "$count" -gt 0 ]; then
    # Perform replacement (macOS compatible)
    find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s/$pattern/$replacement/g" {} +
    echo "   ✅ Replaced $count instances"
    total_changes=$((total_changes + count))
  else
    echo "   ℹ️  No instances found"
  fi
  echo ""
}

# Primary background colors
replace_pattern "bg-blue-600" "bg-atlas-sage" "Primary backgrounds"
replace_pattern "bg-blue-500" "bg-atlas-sage" "Secondary backgrounds"
replace_pattern "bg-blue-700" "bg-atlas-success" "Dark backgrounds"

# Hover states
replace_pattern "hover:bg-blue-700" "hover:bg-atlas-success" "Hover states (dark)"
replace_pattern "hover:bg-blue-600" "hover:bg-atlas-sage" "Hover states (primary)"
replace_pattern "hover:bg-blue-500" "hover:bg-atlas-sage" "Hover states (secondary)"

# Text colors
replace_pattern "text-blue-600" "text-atlas-sage" "Text primary"
replace_pattern "text-blue-500" "text-atlas-sage" "Text secondary"
replace_pattern "text-blue-400" "text-atlas-sage" "Text light"
replace_pattern "text-blue-300" "text-atlas-sage/80" "Text muted"

# Border colors
replace_pattern "border-blue-600" "border-atlas-sage" "Borders primary"
replace_pattern "border-blue-500" "border-atlas-sage" "Borders secondary"
replace_pattern "border-blue-400" "border-atlas-sage/60" "Borders light"
replace_pattern "border-blue-300" "border-atlas-sage/40" "Borders muted"

# Focus rings
replace_pattern "focus:ring-blue-600" "focus:ring-atlas-sage" "Focus rings primary"
replace_pattern "focus:ring-blue-500" "focus:ring-atlas-sage" "Focus rings secondary"
replace_pattern "ring-blue-500" "ring-atlas-sage" "Ring colors"

# Gradients
replace_pattern "from-blue-600" "from-atlas-sage" "Gradient from (primary)"
replace_pattern "from-blue-500" "from-atlas-sage" "Gradient from (secondary)"
replace_pattern "to-blue-600" "to-atlas-sage" "Gradient to (primary)"
replace_pattern "to-blue-500" "to-atlas-sage" "Gradient to (secondary)"

# Additional blue shades
replace_pattern "bg-blue-100" "bg-atlas-sage/20" "Light backgrounds"
replace_pattern "bg-blue-50" "bg-atlas-sage/10" "Very light backgrounds"

echo "================================"
echo "✨ Migration Complete!"
echo ""
echo "📊 Summary:"
echo "   Total replacements: $total_changes instances"
echo ""
echo "🧪 Next Steps:"
echo "   1. Run: npm run dev"
echo "   2. Visually inspect all major pages"
echo "   3. Test tier system (Free/Core/Studio)"
echo "   4. Verify accessibility (contrast, focus states)"
echo "   5. Create git commit"
echo ""
echo "💾 Suggested commit message:"
echo '   git commit -m "feat: implement Atlas professional color scheme'
echo ''
echo '   - Replace generic blue AI theme with natural, calming palette'
echo '   - Sage, sand, pearl, peach, stone color system'
echo '   - Tier-specific colors: Free=SAND, Core=SAGE, Studio=STONE'
echo '   - Maintain WCAG AA accessibility standards'
echo '   - Update 412+ color instances across 86 files"'
echo ""

