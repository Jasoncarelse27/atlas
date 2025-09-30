# Atlas V1 Golden Standard Tier Enforcement - Integration Guide

## 🎯 **Integration Steps**

### **Step 1: Run Supabase Migration**
```bash
# Apply the tier enforcement schema
supabase db push
```

### **Step 2: Update App.tsx**

Add this to your main App component:

```typescript
// Add to imports
import { useTierAccess } from '@/hooks/useTierAccess';

// Add to your App component
function App() {
  const { tier, features, model } = useTierAccess();
  
  // Log current tier for debugging
  console.log('Current Atlas tier:', tier, 'Model:', model);
  
  return (
    <YourAppNavigation />
  );
}
```

### **Step 3: Update ChatScreen.tsx**

Add tier enforcement to message sending:

```typescript
// Add to imports
import { useTierAccess, useMessageLimit } from '@/hooks/useTierAccess';
import toast from 'react-hot-toast';

// Add to your ChatScreen component
function ChatScreen() {
  const { model, claudeModelName } = useTierAccess();
  const { checkAndAttemptMessage } = useMessageLimit();
  const [messageCount, setMessageCount] = useState(0);

  async function handleSendMessage(text: string) {
    // Check message limit before sending
    const canSend = await checkAndAttemptMessage(messageCount);
    if (!canSend) {
      return; // Toast already shown by hook
    }

    try {
      // Route to correct Claude model based on tier
      await chatService.sendMessageStream({
        text,
        model: claudeModelName, // claude-3-haiku-20240307 / sonnet / opus
      });

      setMessageCount(prev => prev + 1);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  }

  return (
    <ChatUI onSend={handleSendMessage} />
  );
}
```

### **Step 4: Update ModeSwitcher.tsx**

Add tier enforcement to mode switching:

```typescript
// Add to imports
import { useFeatureAccess } from '@/hooks/useTierAccess';

// Add to your ModeSwitcher component
function ModeSwitcher() {
  const { canUse: canUseAudio, attemptFeature: attemptAudio } = useFeatureAccess('audio');
  const { canUse: canUseImage, attemptFeature: attemptImage } = useFeatureAccess('image');

  const handleAudioMode = async () => {
    const allowed = await attemptAudio();
    if (allowed) {
      setMode('audio');
    }
    // Toast already shown by hook if not allowed
  };

  const handleImageMode = async () => {
    const allowed = await attemptImage();
    if (allowed) {
      setMode('image');
    }
    // Toast already shown by hook if not allowed
  };

  return (
    <div className="mode-switcher">
      <button 
        onClick={() => setMode('text')}
        className={mode === 'text' ? 'active' : ''}
      >
        Text
      </button>
      
      <button 
        onClick={handleAudioMode}
        className={`${mode === 'audio' ? 'active' : ''} ${!canUseAudio ? 'disabled' : ''}`}
        disabled={!canUseAudio}
      >
        Audio {!canUseAudio && '🔒'}
      </button>
      
      <button 
        onClick={handleImageMode}
        className={`${mode === 'image' ? 'active' : ''} ${!canUseImage ? 'disabled' : ''}`}
        disabled={!canUseImage}
      >
        Image {!canUseImage && '🔒'}
      </button>
    </div>
  );
}
```

### **Step 5: Update InputToolbar.tsx**

Add tier enforcement to input options:

```typescript
// Add to imports
import { useFeatureAccess } from '@/hooks/useTierAccess';

// Add to your InputToolbar component
function InputToolbar() {
  const { canUse: canUseAudio, attemptFeature: attemptAudio } = useFeatureAccess('audio');
  const { canUse: canUseImage, attemptFeature: attemptImage } = useFeatureAccess('image');

  const handleVoiceInput = async () => {
    const allowed = await attemptAudio();
    if (allowed) {
      startVoiceRecording();
    }
  };

  const handleImageUpload = async () => {
    const allowed = await attemptImage();
    if (allowed) {
      openImagePicker();
    }
  };

  return (
    <div className="input-toolbar">
      <input 
        type="text" 
        placeholder="Type your message..."
        onKeyPress={handleKeyPress}
      />
      
      <button 
        onClick={handleVoiceInput}
        className={!canUseAudio ? 'disabled' : ''}
        disabled={!canUseAudio}
        title={!canUseAudio ? 'Upgrade to use voice input' : 'Voice input'}
      >
        🎤 {!canUseAudio && '🔒'}
      </button>
      
      <button 
        onClick={handleImageUpload}
        className={!canUseImage ? 'disabled' : ''}
        disabled={!canUseImage}
        title={!canUseImage ? 'Upgrade to use image analysis' : 'Upload image'}
      >
        📷 {!canUseImage && '🔒'}
      </button>
      
      <button onClick={handleSend}>
        Send
      </button>
    </div>
  );
}
```

## 🎯 **Testing Checklist**

### **Free Tier Testing**
- [ ] Can send 15 messages, then blocked with upgrade prompt
- [ ] Audio button shows lock icon and upgrade toast
- [ ] Image button shows lock icon and upgrade toast
- [ ] Uses Claude Haiku model for responses

### **Core Tier Testing**
- [ ] Unlimited text messages
- [ ] Audio features work
- [ ] Image features work
- [ ] Uses Claude Sonnet model for responses

### **Studio Tier Testing**
- [ ] All features work
- [ ] Uses Claude Opus model for responses
- [ ] Priority processing (if implemented)

## 🔧 **Environment Variables**

Ensure these are set in your `.env`:

```env
# Claude API Keys
CLAUDE_API_KEY=your_claude_api_key

# Supabase (already configured)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Paddle (already configured)
PADDLE_CLIENT_TOKEN=your_paddle_client_token
```

## 🚀 **Next Steps**

1. **Run the migration**: `supabase db push`
2. **Test tier enforcement** in development
3. **Verify Paddle integration** works with upgrade flows
4. **Monitor feature attempts** in Supabase dashboard
5. **Launch V1** with core tier enforcement

## 📊 **Analytics Queries**

After launch, use these queries to monitor conversion:

```sql
-- Feature conversion funnel
SELECT * FROM feature_conversion_funnel;

-- Daily usage by tier
SELECT * FROM daily_feature_usage;

-- Most blocked features
SELECT feature, COUNT(*) as blocked_attempts
FROM feature_attempts 
WHERE allowed = false 
GROUP BY feature 
ORDER BY blocked_attempts DESC;
```

---

**✅ Atlas V1 Golden Standard Tier Enforcement is now ready for integration!**
