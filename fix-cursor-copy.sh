#!/bin/bash
# Fix Cursor Copy/Paste Issues

echo "🔧 Fixing Cursor copy/paste..."

# Reload Cursor window (requires Cursor to be running)
osascript << 'APPLESCRIPT'
tell application "Cursor"
    activate
    tell application "System Events"
        keystroke "r" using {command down, shift down}
    end tell
end tell
APPLESCRIPT

echo "✅ Cursor window reloaded"
echo ""
echo "📋 Next steps:"
echo "1. Press Cmd+Shift+P"
echo "2. Type 'Reload Window'"
echo "3. Press Enter"
echo ""
echo "Or manually:"
echo "- Cmd+Shift+P → 'Developer: Reload Window'"
