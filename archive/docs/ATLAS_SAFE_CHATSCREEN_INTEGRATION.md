# Atlas Safe ChatScreen Integration

## 🎯 **Safe Integration for src/App.tsx**

### **Step 1: Add Imports (at the top of App.tsx)**

Add these imports to your existing imports section:

```typescript
// Add these imports to your existing import section
import { useTierAccess, useMessageLimit } from '@/hooks/useTierAccess';
import toast from 'react-hot-toast';
```

### **Step 2: Add Tier Access Hook (inside App component)**

Add this hook call inside your App component, after your existing hooks:

```typescript
// Add this inside your App component, after existing hooks
const { tier, model, claudeModelName } = useTierAccess();
const { checkAndAttemptMessage } = useMessageLimit();
const [messageCount, setMessageCount] = useState(0);
```

### **Step 3: Update handleSendMessage Function**

Replace your existing `handleSendMessage` function with this enhanced version:

```typescript
// Replace your existing handleSendMessage function with this
const handleSendMessage = async (message: string) => {
  if (isProcessing || !message.trim()) return;
  
  // 🎯 TIER ENFORCEMENT: Check message limit
  const canSend = await checkAndAttemptMessage(messageCount);
  if (!canSend) {
    return; // Toast already shown by hook
  }
   
  setIsProcessing(true);
  setResponse('');
  setAudioUrl(null);
  
  // Create or get current conversation
  let conversationToUse = currentConversation;
  if (!conversationToUse) {
    conversationToUse = createConversation();
    console.log('Created new conversation:', conversationToUse.id); 
  }
  
  // Add user message to conversation
  const userMessage: Message = {
    id: uuidv4(),
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
   
  try {
    addMessageToConversation(conversationToUse.id, userMessage);
  } catch (error) {
    console.error('Error adding message to conversation:', error);
    // If adding message fails, create a new conversation and try again
    conversationToUse = createConversation();
    console.log('Created fallback conversation:', conversationToUse.id);
    try { 
      addMessageToConversation(conversationToUse.id, userMessage);
    } catch (fallbackError) {
      console.error('Error adding message to fallback conversation:', fallbackError);
      setIsProcessing(false);
      return;
    }
  }
   
  try {
    // Send message to local backend
    console.log('📤 Sending message to local backend:', message);
    console.log('🎯 Using tier:', tier, 'Model:', claudeModelName);
    
    // Use local backend
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    
    const response = await fetch(`${backendUrl}/api/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        message: message,
        conversationId: conversationToUse.id,
        model: claudeModelName // 🎯 TIER-BASED MODEL ROUTING
      })
    });
     
    if (!response.ok) {
      throw new Error(`Backend request failed with status ${response.status}`);
    }
    
    const responseData = await response.json();
    console.log('📥 Received response from backend:', responseData);
    
    // Check if we have a valid response 
    if (!responseData.response) {
      throw new Error('No response received from backend');
    }
    
    // Add assistant response to conversation
    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: responseData.response,
      timestamp: new Date().toISOString(),
      audioUrl: responseData.audioUrl
    };
     
    try {
      addMessageToConversation(conversationToUse.id, assistantMessage);
    } catch (error) {
      console.error('Error adding assistant message to conversation:', error);
    }
    
    setResponse(responseData.response);
    
    // 🎯 INCREMENT MESSAGE COUNT
    setMessageCount(prev => prev + 1);
    
    // Play success sound
    if (onSoundPlay) {
      onSoundPlay('success');
    }
    
  } catch (error) {
    console.error('Error in handleSendMessage:', error);
    setResponse('Sorry, I encountered an error. Please try again.');
    
    // Play error sound
    if (onSoundPlay) {
      onSoundPlay('error');
    }
  } finally {
    setIsProcessing(false);
  }
};
```

### **Step 4: Add Tier Display (Optional)**

Add this to your UI to show current tier and remaining messages:

```typescript
// Add this to your JSX, somewhere visible (like in the header)
<div className="tier-info">
  <span className="tier-badge">Atlas {tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
  {tier === 'free' && (
    <span className="message-count">
      {15 - messageCount} messages left
    </span>
  )}
</div>
```

## 🎯 **What This Integration Does**

### **✅ Tier Enforcement**
- **Free users**: Limited to 15 messages, then blocked with upgrade prompt
- **Core users**: Unlimited messages, uses Claude Sonnet
- **Studio users**: Unlimited messages, uses Claude Opus

### **✅ Model Routing**
- **Free**: `claude-3-haiku-20240307` (fastest, cheapest)
- **Core**: `claude-3-sonnet-20240229` (balanced)
- **Studio**: `claude-3-opus-20240229` (highest quality)

### **✅ User Experience**
- Clear upgrade prompts when limits hit
- Tier information displayed
- Message count tracking
- Non-blocking error handling

## 🧪 **Testing After Integration**

### **Free Tier Test**
1. Send 15 messages → should work
2. Send 16th message → should show upgrade toast
3. Check console logs for "claude-3-haiku" model

### **Core/Studio Tier Test**
1. Send unlimited messages → should work
2. Check console logs for "claude-3-sonnet" or "claude-3-opus"

## 🚀 **Next Steps**

1. **Apply the migration** via Supabase Dashboard
2. **Integrate this code** into your App.tsx
3. **Test the tier enforcement**
4. **Verify model routing** in console logs

This integration is **safe and non-destructive** - it only adds tier enforcement without breaking existing functionality.
