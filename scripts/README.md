# 🚀 Atlas AI Development Scripts

This directory contains automated scripts for managing the Atlas AI development environment.

## 📋 Available Scripts

### 🔧 Port Management Scripts

#### `kill-port-and-run-backend.js` (Recommended - Cross-Platform)
- **Purpose**: Automatically clears port 8000 and starts the backend server
- **Features**: 
  - Cross-platform compatibility (Windows, macOS, Linux)
  - Colored console output
  - Automatic port conflict resolution
  - Process management and cleanup
- **Usage**: `npm run dev:backend`

#### `kill-port-and-run-backend.sh` (Unix/macOS)
- **Purpose**: Bash script for Unix-based systems
- **Features**: Simple port clearing and backend startup
- **Usage**: `./scripts/kill-port-and-run-backend.sh`

#### `kill-port-and-run-backend.bat` (Windows)
- **Purpose**: Batch script for Windows systems
- **Features**: Windows-specific port management
- **Usage**: `scripts\kill-port-and-run-backend.bat`

### 🎯 Package.json Scripts

```json
{
  "dev": "nodemon backend/server.mjs",           // Original backend dev
  "dev:backend": "node scripts/kill-port-and-run-backend.js",  // Smart backend dev
  "dev:frontend": "vite",                        // Frontend dev server
  "dev:full": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"", // Both servers
  "kill-port": "node scripts/kill-port-and-run-backend.js",    // Just clear port
  "port-clear": "lsof -ti :8000 | xargs kill -9"              // Quick port clear
}
```

## 🚀 Quick Start

### Option 1: Smart Backend Development (Recommended)
```bash
npm run dev:backend
```
- Automatically handles port conflicts
- Starts backend server with conflict resolution
- Cross-platform compatibility

### Option 2: Full Stack Development
```bash
npm run dev:full
```
- Runs both backend and frontend simultaneously
- Backend on port 8000, Frontend on port 5173
- Automatic port conflict resolution

### Option 3: Individual Servers
```bash
# Terminal 1: Backend with smart port management
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend
```

## 🔍 Port Conflict Resolution

The scripts automatically handle the common `EADDRINUSE` error:

1. **Detect**: Check if port 8000 is occupied
2. **Clear**: Kill processes using port 8000
3. **Verify**: Confirm port is free
4. **Start**: Launch backend server
5. **Monitor**: Handle graceful shutdown

## 🛠️ Manual Port Management

### Quick Port Clear (Unix/macOS)
```bash
npm run port-clear
```

### Check Port Status
```bash
# Unix/macOS
lsof -i :8000

# Windows
netstat -ano | findstr :8000
```

## 🔧 Troubleshooting

### Port Still in Use After Script
1. Check for zombie processes: `ps aux | grep node`
2. Force kill: `pkill -f "node.*server.mjs"`
3. Restart terminal/IDE
4. Check system processes: `lsof -i :8000`

### Script Permission Issues
```bash
chmod +x scripts/kill-port-and-run-backend.sh
chmod +x scripts/kill-port-and-run-backend.js
```

### Windows Issues
- Ensure PowerShell/Command Prompt has admin privileges
- Use the `.bat` version for Windows-specific commands

## 📱 Development Workflow

### Daily Development
```bash
# Start with smart port management
npm run dev:backend

# In another terminal, start frontend
npm run dev:frontend
```

### Quick Testing
```bash
# Just clear port and test
npm run kill-port
```

### Full Stack Development
```bash
# One command for everything
npm run dev:full
```

## 🎯 Benefits

- ✅ **No More Port Conflicts**: Automatic resolution
- ✅ **Cross-Platform**: Works on Windows, macOS, Linux
- ✅ **Developer Experience**: One command startup
- ✅ **Error Handling**: Graceful fallbacks and clear messages
- ✅ **Process Management**: Proper cleanup and shutdown
- ✅ **Colored Output**: Easy-to-read console messages

## 🔄 Updates and Maintenance

These scripts are automatically maintained and updated as part of the Atlas AI development workflow. For issues or improvements, check the main project repository.
