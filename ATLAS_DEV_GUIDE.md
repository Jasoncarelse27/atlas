# 🚀 Atlas Development Guide

## Quick Start Commands

### 🌍 **Web Development (Browser Testing)**
```bash
# Start Atlas in web mode (Chrome/Safari) - Pure Vite, no Metro
npm run dev:web
# Opens at: http://localhost:5174
```

### 📱 **Native Development (Expo Go / Simulator)**
```bash
# Start Atlas in native mode (iOS/Android)
npm run dev:native
# Opens Metro bundler with QR code for Expo Go
```

### 🔧 **Backend Development**
```bash
# Start Atlas backend API
npm run backend
# Runs on: http://localhost:8000
```

### 🎯 **Full Stack Development**
```bash
# Start both backend and frontend
npm run dev:all
# Backend: http://localhost:8000
# Frontend: http://localhost:5175 (Vite)
```

## Development Modes Explained

### **Web Mode (`npm run dev:web`)**
- **Use for**: Browser testing, QA testing, web development
- **Opens**: Chrome/Safari with proper web assets
- **No 404/MIME errors**: Pure Vite bundler, no Metro
- **Port**: 5174 (Vite dev server)

### **Native Mode (`npm run dev:native`)**
- **Use for**: Mobile testing, Expo Go, iOS/Android simulators
- **Opens**: Metro bundler with QR code
- **Features**: Hot reload, device debugging
- **Port**: 8081 (Metro bundler)

### **Vite Mode (`npm run frontend`)**
- **Use for**: Pure web development, fast HMR
- **Opens**: Vite dev server
- **Features**: Fast hot module replacement
- **Port**: 5175 (Vite server)

## Testing Workflow

### **For QA Testing:**
1. Start backend: `npm run backend`
2. Start web mode: `npm run dev:web`
3. Open browser: `http://localhost:8081`
4. Execute QA checklist

### **For Mobile Testing:**
1. Start backend: `npm run backend`
2. Start native mode: `npm run dev:native`
3. Scan QR code with Expo Go app
4. Test on real device

### **For Development:**
1. Start backend: `npm run backend`
2. Start Vite: `npm run frontend`
3. Open browser: `http://localhost:5175`
4. Fast development with HMR

## Troubleshooting

### **404/MIME Errors**
- **Problem**: Opening native mode in browser
- **Solution**: Use `npm run dev:web` for browser testing

### **Port Conflicts**
- **Problem**: Port already in use
- **Solution**: Kill existing processes or use different ports

### **Backend Connection Issues**
- **Problem**: Frontend can't reach backend
- **Solution**: Ensure backend is running on port 8000

## Environment Variables

Make sure your `.env` file has:
```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
ANTHROPIC_API_KEY=your_anthropic_key
```

## Cross-Platform Compatibility

All scripts work on:
- ✅ **macOS** (tested)
- ✅ **Linux** (compatible)
- ✅ **Windows** (compatible with WSL)

## Quick Reference

| Command | Purpose | Port | Use Case |
|---------|---------|------|----------|
| `npm run dev:web` | Web testing | 5174 | Browser QA |
| `npm run dev:native` | Mobile testing | 8081 | Expo Go/Sim |
| `npm run frontend` | Web development | 5175 | Fast HMR |
| `npm run backend` | API server | 8000 | Backend API |
| `npm run dev:all` | Full stack | 8000+5175 | Complete dev |

---

**Choose the right mode for your testing needs!** 🎯
