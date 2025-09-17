# Atlas Mobile App

A React Native mobile application built with Expo.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# For tunnel mode (recommended for iPhone testing)
npx expo start --tunnel
```

## Known Issues & Solutions

### Tunnel Connection Issues
**Problem:** Tunnel endpoint goes offline with HTTP 404 error
**Solution:** 
```bash
pkill -f "expo start"
npx expo start --tunnel --clear
```

### Testing on iPhone
1. Install Expo Go app on your iPhone
2. Scan QR code from terminal
3. Or use Camera app to scan QR code

## Development Status
✅ **Working** - Atlas mobile app is ready for testing
✅ **Tunnel Connected** - Ready for iPhone testing
✅ **Cross-platform** - Works on iOS, Android, and Web

## Current QR Code
Available in terminal when running `npx expo start --tunnel` 