# 🧪 Atlas Chat Flow Test

## ✅ **Backend Test (Working)**
```bash
curl -X POST http://localhost:8000/message \
  -H "Content-Type: application/json" \
  -d '{"userId":"0a8726d5-af01-44d3-b635-f0d276d3d3d3","text":"hi"}'
```

**Expected Response:**
```json
{
  "success": true,
  "model": "claude-3-5-sonnet-20241022",
  "tier": "studio",
  "reply": "Hello! How can I help you today?"
}
```

## 🔍 **Frontend Test Steps**

### 1. Open Atlas in Browser
- Go to `http://localhost:5174/chat`
- Open DevTools Console (F12)

### 2. Send a Test Message
- Type "hi" in the chat input
- Press Enter or click Send
- Watch console for these logs:

**Expected Console Logs:**
```
[FLOW] sendMessage called with text: hi
[FLOW] Sending to backend: http://localhost:8000/message
[FLOW] Backend response status: 200
Backend response data: {success: true, model: "claude-3-5-sonnet-20241022", tier: "studio", reply: "Hello! How can I help you today?"}
✅ Using data.reply: Hello! How can I help you today?
✅ Final response text: Hello! How can I help you today?
[ChatPage] ✅ Added assistant response to message store
```

### 3. Check UI
- User message should appear immediately
- Assistant response should appear after backend call
- No error messages in console

## 🚨 **Common Issues & Solutions**

### Issue 1: "Backend unreachable"
- **Cause:** Frontend can't reach backend
- **Solution:** Check `VITE_API_URL` in `.env.development` is `http://localhost:8000`

### Issue 2: "CORS error"
- **Cause:** Backend CORS not allowing frontend origin
- **Solution:** Backend CORS is already fixed ✅

### Issue 3: "401 Unauthorized"
- **Cause:** JWT authentication issue
- **Solution:** Backend has development mode bypass ✅

### Issue 4: "No assistant response in UI"
- **Cause:** `chatService.sendMessage` not returning response
- **Solution:** Check console for error logs

## 🎯 **Success Criteria**
- [ ] User message appears immediately
- [ ] Backend call succeeds (status 200)
- [ ] Assistant response appears in chat
- [ ] No console errors
- [ ] Message persists after refresh

## 🔧 **Debug Commands**
```bash
# Check backend health
curl http://localhost:8000/healthz

# Test backend message endpoint
curl -X POST http://localhost:8000/message \
  -H "Content-Type: application/json" \
  -d '{"userId":"0a8726d5-af01-44d3-b635-f0d276d3d3d3","text":"test"}'

# Check frontend environment
echo $VITE_API_URL
```
