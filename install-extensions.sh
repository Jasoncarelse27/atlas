#!/bin/bash

echo "🚀 Installing essential VS Code extensions..."

# Check if VS Code CLI is available
if ! command -v code &> /dev/null; then
    echo "❌ VS Code CLI not found. Please install it first:"
    echo "1. Open VS Code"
    echo "2. Press Cmd+Shift+P"
    echo "3. Type: Shell Command: Install 'code' command in PATH"
    echo "4. Press Enter and enter your password"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Essential extensions to install
EXTENSIONS=(
    "ms-vscode.vscode-typescript-next"
    "bradlc.vscode-tailwindcss"
    "esbenp.prettier-vscode"
    "dbaeumer.vscode-eslint"
    "formulahendry.auto-rename-tag"
    "christian-kohler.path-intellisense"
    "eamodio.gitlens"
    "usernamehw.errorlens"
    "wix.vscode-import-cost"
    "pkief.material-icon-theme"
)

echo "Installing ${#EXTENSIONS[@]} essential extensions..."

for extension in "${EXTENSIONS[@]}"; do
    echo "Installing $extension..."
    code --install-extension "$extension"
done

echo "✅ Extension installation complete!"
echo "Restart VS Code to see all changes."

