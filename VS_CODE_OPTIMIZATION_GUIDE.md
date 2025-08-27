# VS Code Optimization Guide for Atlas

This guide provides comprehensive recommendations for optimizing VS Code performance and productivity for the Atlas project.

## 🚀 Quick Setup

### 1. Install Recommended Extensions
VS Code will prompt you to install recommended extensions when you open the project. Click "Install All" to get the essential tools.

### 2. Essential Extensions to Install Manually
```bash
# Core Development
- TypeScript Importer
- Auto Rename Tag
- Path Intellisense
- CSS Peek
- Tailwind CSS IntelliSense

# Productivity
- GitLens
- Error Lens
- Import Cost
- Better Comments
- Todo Tree

# Testing
- Jest Runner
- Playwright Test for VSCode

# Database (for Supabase)
- PostgreSQL
- SQLTools

# AI Assistance (Optional)
- GitHub Copilot
- GitHub Copilot Chat
```

## ⚡ Performance Optimizations

### 1. File Watching Exclusions
The `.vscode/settings.json` file is configured to exclude:
- `node_modules/` - Reduces file watching overhead
- `dist/` - Build output directory
- `coverage/` - Test coverage reports
- `.git/` - Git metadata

### 2. Search Exclusions
Optimized search to skip:
- Large binary files
- Build artifacts
- Dependencies
- Lock files

### 3. TypeScript Server Optimization
- Increased memory limit to 3GB
- Optimized watch options for macOS
- Enabled incremental compilation

### 4. Editor Performance
- Disabled preview mode for editors
- Optimized minimap settings
- Reduced hover delay
- Enabled bracket pair colorization

## 🛠️ Development Workflow

### 1. Using Tasks (Ctrl/Cmd + Shift + P > "Tasks: Run Task")
- **npm: dev** - Start development server
- **npm: build** - Build for production
- **npm: lint** - Run ESLint
- **npm: type-check** - TypeScript type checking
- **Pre-commit checks** - Run all quality checks
- **Clean node_modules** - Fresh dependency install

### 2. Debugging (F5)
- **Launch Chrome** - Debug in Chrome
- **Debug Tests** - Debug unit tests
- **Debug E2E Tests** - Debug Playwright tests

### 3. Code Snippets
Use these snippets to speed up development:
- `rfc` - React functional component
- `rhook` - Custom React hook
- `tinterface` - TypeScript interface
- `twcard` - Tailwind card component
- `usestate` - useState hook
- `useeffect` - useEffect hook

## 📁 Project Structure Optimization

### 1. Workspace Organization
```
atlas/
├── .vscode/           # VS Code configuration
├── src/
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   ├── lib/           # Utilities and services
│   ├── pages/         # Page components
│   └── types/         # TypeScript types
├── supabase/          # Supabase functions
└── public/            # Static assets
```

### 2. File Naming Conventions
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `camelCase.ts`
- Types: `camelCase.ts`

## 🔧 Advanced Configuration

### 1. Git Integration
- Auto-fetch enabled (every 3 minutes)
- Smart commit enabled
- Git history visualization

### 2. Terminal Optimization
- Zsh as default shell
- Optimized font size and line height
- Integrated terminal with project context

### 3. IntelliSense Enhancements
- Auto-imports enabled
- Path suggestions
- Tailwind CSS class completion
- React component suggestions

## 🧹 Maintenance Tasks

### 1. Regular Cleanup (Run Monthly)
```bash
# Clean build artifacts
npm run clean

# Update dependencies
npm update

# Clear VS Code cache
# Cmd+Shift+P > "Developer: Reload Window"

# Clear TypeScript cache
rm -rf ~/Library/Caches/typescript
```

### 2. Performance Monitoring
- Monitor Activity Monitor for high CPU processes
- Check VS Code memory usage
- Review extension performance

### 3. Extension Management
- Disable unused extensions
- Update extensions regularly
- Monitor extension conflicts

## 🎯 Productivity Tips

### 1. Keyboard Shortcuts
- `Cmd+P` - Quick file open
- `Cmd+Shift+P` - Command palette
- `Cmd+Shift+F` - Global search
- `F12` - Go to definition
- `Shift+F12` - Find all references
- `Cmd+Click` - Go to definition
- `Cmd+Shift+O` - Go to symbol

### 2. Multi-Cursor Editing
- `Cmd+D` - Select next occurrence
- `Cmd+Shift+L` - Select all occurrences
- `Alt+Click` - Add cursor
- `Cmd+Alt+Up/Down` - Add cursor above/below

### 3. Code Navigation
- `Cmd+T` - Go to symbol in workspace
- `Cmd+G` - Go to line
- `Cmd+Shift+M` - Show problems
- `F8` - Next problem
- `Shift+F8` - Previous problem

## 🔍 Troubleshooting

### 1. Slow Performance
1. Restart TypeScript server: `Cmd+Shift+P > "TypeScript: Restart TS Server"`
2. Reload VS Code window: `Cmd+Shift+P > "Developer: Reload Window"`
3. Disable heavy extensions temporarily
4. Check Activity Monitor for high CPU processes

### 2. IntelliSense Issues
1. Clear TypeScript cache
2. Restart TypeScript server
3. Check for conflicting extensions
4. Verify `tsconfig.json` configuration

### 3. Extension Conflicts
1. Disable extensions one by one
2. Check extension compatibility
3. Update extensions to latest versions
4. Report issues to extension authors

## 📊 Performance Metrics

### Target Performance
- File opening: < 100ms
- IntelliSense suggestions: < 200ms
- Search results: < 500ms
- Build time: < 30s
- Hot reload: < 2s

### Monitoring Commands
```bash
# Check VS Code memory usage
ps aux | grep "Code Helper"

# Monitor file watchers
lsof | grep "Code Helper" | wc -l

# Check TypeScript server
ps aux | grep "tsserver"
```

## 🎨 Theme and Customization

### Recommended Themes
- Material Icon Theme
- One Dark Pro
- Dracula
- Night Owl
- Tokyo Night

### Custom Settings
- Font: JetBrains Mono or Fira Code
- Font size: 14px
- Line height: 1.2
- Tab size: 2 spaces

## 🔒 Security Considerations

### 1. Extension Security
- Only install extensions from trusted publishers
- Review extension permissions
- Keep extensions updated
- Disable telemetry for privacy

### 2. Workspace Security
- Don't commit sensitive data
- Use environment variables
- Review file permissions
- Enable workspace trust

## 📚 Additional Resources

### Documentation
- [VS Code User Guide](https://code.visualstudio.com/docs)
- [TypeScript in VS Code](https://code.visualstudio.com/docs/typescript/typescript-compiling)
- [React Development in VS Code](https://code.visualstudio.com/docs/nodejs/reactjs-tutorial)

### Community
- [VS Code Marketplace](https://marketplace.visualstudio.com/vscode)
- [VS Code GitHub](https://github.com/microsoft/vscode)
- [VS Code Discord](https://discord.gg/vscode)

---

## 🚀 Quick Commands Reference

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview build

# Quality
npm run lint         # Run ESLint
npm run type-check   # TypeScript check
npm run format       # Format code
npm run test         # Run tests

# Maintenance
npm run clean        # Clean build artifacts
npm run analyze      # Bundle analysis
npm audit            # Security audit
```

This configuration will significantly improve your VS Code performance and development experience with the Atlas project!
