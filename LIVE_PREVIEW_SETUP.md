# 📱 **ATLAS LIVE PREVIEW SETUP**

## 🎯 **View Atlas Live While You Work**

Atlas is configured as an Expo project, so you can preview it in multiple ways while making changes.

---

## 🚀 **Quick Start Commands**

### **Option 1: Web Browser (Fastest for UI iteration)**
```bash
cd /Users/jasoncarelse/atlas
npm run frontend
# or
npx expo start --web
```
- **Opens in:** Chrome/Safari at `http://localhost:8081`
- **Best for:** Quick UI/UX changes, CSS tweaks, component testing
- **Reload:** Instant hot reload on code changes

### **Option 2: iOS Simulator (Realistic mobile testing)**
```bash
cd /Users/jasoncarelse/atlas
npx expo start -c
# Press 'i' when prompted to open iOS Simulator
```
- **Opens in:** Xcode iOS Simulator
- **Best for:** Mobile UX testing, touch interactions, responsive design
- **Requirement:** Xcode installed on Mac

### **Option 3: Real iPhone (True user experience)**
```bash
cd /Users/jasoncarelse/atlas
npx expo start -c
# Scan QR code with iPhone camera or Expo Go app
```
- **Opens in:** Expo Go app on your iPhone
- **Best for:** Real device testing, performance validation, final UX polish
- **Requirement:** Expo Go app installed on iPhone

---

## 🔧 **Development Workflow**

### **Full Stack Development:**
```bash
# Terminal 1: Backend server
cd /Users/jasoncarelse/atlas
npm run backend

# Terminal 2: Frontend with hot reload
cd /Users/jasoncarelse/atlas
npm run frontend
```

### **All-in-One Development:**
```bash
cd /Users/jasoncarelse/atlas
npm run dev:all
# Runs both backend and frontend concurrently
```

### **Atlas Development Script:**
```bash
cd /Users/jasoncarelse/atlas
npm run atlas
# or
./dev.sh
```

---

## 📊 **Live Testing Capabilities**

### **🎨 UI/UX Testing:**
- **Real-time Changes:** See UI updates instantly as you modify components
- **Responsive Testing:** Resize browser or use device simulator for mobile testing
- **Theme Testing:** Toggle dark/light mode and see changes immediately
- **Component Testing:** Test individual components in isolation

### **🔐 Authentication Testing:**
- **Signup Flow:** Test new user registration with real Supabase
- **Login Flow:** Validate existing user authentication
- **Error Handling:** Test wrong passwords, network issues, etc.
- **Session Management:** Test logout, session persistence, etc.

### **💬 Chat Experience Testing:**
- **Message Sending:** Test real-time message sending to backend
- **Streaming Responses:** See AI responses stream in real-time
- **Tier Enforcement:** Test 15-message limit for free tier
- **Model Selection:** Validate Haiku/Sonnet/Opus routing

### **💳 Subscription Testing:**
- **Upgrade Flows:** Test Paddle checkout integration
- **Tier Changes:** See immediate tier updates in UI
- **Usage Tracking:** Monitor message counts and limits
- **Admin Dashboard:** View real-time analytics

---

## 🧪 **QA Testing Workflow**

### **Manual Testing Process:**
1. **Start Live Preview:**
   ```bash
   npx expo start --web
   # Opens in browser for quick testing
   ```

2. **Run QA Checklist:**
   - Open `UI_UX_TESTING_CHECKLIST.md`
   - Test each item while app runs live
   - Check boxes as you validate features

3. **Test Paddle Integration:**
   - Open `PADDLE_BILLING_TESTING_CHECKLIST.md`
   - Use Paddle Sandbox for subscription testing
   - Validate tier changes in real-time

4. **Run Automated Tests:**
   ```bash
   node scripts/qa-automated-tests.mjs
   # Validates backend and API integration
   ```

### **Development Testing Loop:**
1. **Make Code Changes** in Cursor
2. **See Changes Instantly** in live preview
3. **Test Functionality** using QA checklists
4. **Validate with Automated Tests** for backend integration
5. **Repeat** until all tests pass

---

## 🎯 **Recommended Testing Sequence**

### **Phase 1: Core Functionality (Web)**
```bash
# Start web preview
npx expo start --web

# Test core features:
# - Login/signup flow
# - Chat experience with streaming
# - Settings and tier display
# - Error handling and offline behavior
```

### **Phase 2: Mobile Experience (Simulator)**
```bash
# Start with iOS simulator
npx expo start -c
# Press 'i' for iOS simulator

# Test mobile-specific features:
# - Touch interactions
# - Responsive design
# - Keyboard handling
# - Performance on mobile
```

### **Phase 3: Real Device Testing**
```bash
# Start with real device
npx expo start -c
# Scan QR code with iPhone

# Test real-world usage:
# - Actual touch feel
# - Battery usage
# - Network conditions
# - True user experience
```

### **Phase 4: Paddle Integration (Sandbox)**
```bash
# Keep app running in any mode
# Follow PADDLE_BILLING_TESTING_CHECKLIST.md
# Test subscription flows in Paddle Sandbox
```

---

## 🔍 **Live Debugging Capabilities**

### **Real-time Monitoring:**
- **Console Logs:** See backend logs in terminal
- **Network Requests:** Monitor API calls in browser dev tools
- **State Changes:** Track React state updates with React DevTools
- **Database Changes:** Watch Supabase real-time updates

### **Performance Monitoring:**
- **Response Times:** Monitor API response speeds
- **Memory Usage:** Track memory consumption during testing
- **Network Usage:** Monitor data usage and offline behavior
- **Battery Impact:** Test on real device for battery efficiency

---

## 📱 **Device Testing Matrix**

### **Web Browsers:**
- [ ] **Chrome:** Full feature testing
- [ ] **Safari:** iOS compatibility validation
- [ ] **Firefox:** Cross-browser compatibility
- [ ] **Edge:** Windows user experience

### **Mobile Devices:**
- [ ] **iPhone (iOS Simulator):** Touch interactions, responsive design
- [ ] **iPhone (Real Device):** True user experience, performance
- [ ] **iPad:** Tablet layout and functionality
- [ ] **Android (if available):** Cross-platform compatibility

---

## 🎊 **Live Preview Benefits**

### **🔄 Instant Feedback Loop:**
- **Code Changes:** See updates immediately without rebuilding
- **UI Tweaks:** Instant visual feedback for design changes
- **Feature Testing:** Test new features as you build them
- **Bug Fixing:** Immediate validation of fixes

### **🎯 Real User Experience:**
- **Actual Performance:** True app speed and responsiveness
- **Touch Interactions:** Real mobile touch behavior
- **Network Conditions:** Test with real network latency
- **Device Constraints:** True mobile memory and performance limits

### **📊 Quality Assurance:**
- **Comprehensive Testing:** All QA checklists can be executed live
- **Real-time Validation:** Immediate feedback on changes
- **Professional Polish:** See exactly what users will experience
- **Launch Confidence:** Validate everything before going live

---

## 🚀 **Start Live Preview Now:**

```bash
cd /Users/jasoncarelse/atlas
npx expo start -c
```

**Then choose your testing mode:**
- **Press 'w'** for web browser (fastest iteration)
- **Press 'i'** for iOS simulator (realistic mobile)
- **Scan QR code** with iPhone for real device testing

**Atlas will be live and updating in real-time as you make changes! 🎉**

---

## 📞 **Troubleshooting**

### **Common Issues:**
- **Port Conflicts:** Stop other servers running on port 8081
- **Expo CLI:** Install with `npm install -g @expo/cli` if needed
- **iOS Simulator:** Requires Xcode installation
- **Real Device:** Requires Expo Go app from App Store

### **Quick Fixes:**
```bash
# Clear Expo cache
npx expo start -c --clear

# Reset Metro bundler
npx expo start --reset-cache

# Check Expo status
npx expo doctor
```

**Ready to see Atlas live in action! 🚀**
