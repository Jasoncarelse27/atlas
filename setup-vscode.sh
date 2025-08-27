#!/bin/bash

echo "🚀 Setting up VS Code optimization for Atlas..."

# Create directories
mkdir -p .vscode scripts

# Create settings.json
cat > .vscode/settings.json << 'EOF'
{
  "files.watcherExclude": {"**/node_modules/**": true, "**/dist/**": true, "**/coverage/**": true, "**/.git/**": true},
  "search.exclude": {"**/node_modules": true, "**/dist": true, "**/coverage": true, "**/.git": true},
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {"source.fixAll.eslint": "explicit", "source.organizeImports": "explicit"},
  "editor.tabSize": 2,
  "editor.minimap.enabled": true,
  "editor.bracketPairColorization.enabled": true,
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000,
  "tailwindCSS.includeLanguages": {"typescript": "javascript", "typescriptreact": "javascript"},
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],
  "git.enableSmartCommit": true,
  "git.autofetch": true,
  "terminal.integrated.defaultProfile.osx": "zsh",
  "workbench.editor.enablePreview": false,
  "extensions.autoUpdate": true,
  "telemetry.telemetryLevel": "off"
}
EOF

# Create extensions.json
cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "eamodio.gitlens",
    "usernamehw.errorlens",
    "wix.vscode-import-cost",
    "pkief.material-icon-theme",
    "github.copilot",
    "github.copilot-chat"
  ]
}
EOF

# Create tasks.json
cat > .vscode/tasks.json << 'EOF'
{
  "version": "2.0.0",
  "tasks": [
    {"label": "npm: dev", "type": "npm", "script": "dev", "group": "build", "isBackground": true},
    {"label": "npm: build", "type": "npm", "script": "build", "group": {"kind": "build", "isDefault": true}},
    {"label": "npm: lint", "type": "npm", "script": "lint", "group": "test"},
    {"label": "npm: type-check", "type": "npm", "script": "type-check", "group": "test"},
    {"label": "Clean", "type": "shell", "command": "rm -rf dist coverage .vite", "group": "build"}
  ]
}
EOF

# Create launch.json
cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run"],
      "console": "integratedTerminal"
    }
  ]
}
EOF

# Create snippets.json
cat > .vscode/snippets.json << 'EOF'
{
  "React Component": {
    "prefix": "rfc",
    "body": [
      "import React from 'react';",
      "",
      "interface ${1:ComponentName}Props {",
      "  $2",
      "}",
      "",
      "export const ${1:ComponentName}: React.FC<${1:ComponentName}Props> = ({ $3 }) => {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  );",
      "};"
    ]
  },
  "useState": {
    "prefix": "usestate",
    "body": ["const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState<${2:string}>(${3:''});"]
  },
  "useEffect": {
    "prefix": "useeffect",
    "body": ["useEffect(() => {", "  $1", "}, [${2:dependencies}]);"]
  },
  "Tailwind Card": {
    "prefix": "twcard",
    "body": ["<div className=\"bg-white dark:bg-gray-800 rounded-lg shadow-md p-6\">", "  $0", "</div>"]
  }
}
EOF

# Add npm scripts
npm pkg set scripts.clean="rm -rf dist coverage .vite"
npm pkg set scripts.vscode:performance="echo 'VS Code Performance: CPU $(top -l 1 | grep CPU | awk \"{print \\$3}\"), Memory $(vm_stat | grep free | awk \"{print \\$3}\"), Processes $(ps aux | grep -i code | grep -v grep | wc -l)'"
npm pkg set scripts.pre-commit="npm run lint && npm run type-check"

# Create simple maintenance script
cat > scripts/vscode-maintenance.sh << 'EOF'
#!/bin/bash
echo "🧹 VS Code Maintenance"
rm -rf dist coverage .vite 2>/dev/null || true
npm cache clean --force
echo "✅ Done! Restart VS Code."
EOF

chmod +x scripts/vscode-maintenance.sh

# Add to .gitignore
echo "" >> .gitignore
echo "# VS Code" >> .gitignore
echo ".vscode/chrome-debug-profile/" >> .gitignore

echo "✅ VS Code optimization complete!"
echo "Next: code . (then install extensions when prompted)"
