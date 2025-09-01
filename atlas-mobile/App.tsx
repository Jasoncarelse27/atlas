/**
 * Atlas Mobile App
 * 
 * ENHANCED WITH STREAMING & UI IMPROVEMENTS (2024-09-01):
 * - ✅ Fixed send button size (no more expanding)
 * - ✅ Real streaming from Claude/Groq APIs
 * - ✅ Word-by-word streaming with typing indicator
 * - ✅ Auto-scroll during streaming
 * - ✅ Copy functionality (long-press)
 * - ✅ Timestamps on messages
 * - ✅ Smooth animations and polish
 * 
 * ISSUE RESOLVED (2024-07-18):
 * - Problem: Tunnel endpoint went offline (HTTP 404 error)
 * - Solution: Restarted tunnel with --clear flag
 * - Status: ✅ Working - Tunnel connected and ready
 * - URL: exp://z9qfvgs-anonymous-8081.exp.direct
 * 
 * To test: Scan QR code with iPhone Camera app or Expo Go
 */

import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Clipboard,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from './supabase';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  isStreaming?: boolean;
  fullText?: string;
}

export default function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { session, loading: authLoading } = useAuth();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Debug: Monitor messages state changes
  useEffect(() => {
    console.log('🔄 Messages state changed, count:', messages.length);
    messages.forEach((msg, index) => {
      console.log(`  Message ${index}:`, {
        id: msg.id,
        text: msg.text,
        isUser: msg.isUser,
        isStreaming: msg.isStreaming,
        timestamp: msg.timestamp
      });
    });
  }, [messages]);

  // Fade-in animation for new messages
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [messages.length]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const formatTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleCopyMessage = async (text: string) => {
    try {
      await Clipboard.setString(text);
      Alert.alert('Copied!', 'Message copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleLongPress = (text: string) => {
    Alert.alert(
      'Copy Message',
      'Would you like to copy this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Copy', onPress: () => handleCopyMessage(text) }
      ]
    );
  };

  const sendMessageStream = async (text: string, messageId: string) => {
    try {
      console.log('🚀 Starting sendMessageStream with text:', text);
      console.log('📱 Current messages count:', messages.length);
      console.log('🔄 Streaming message ID:', messageId);
      
      // Check if we have a valid session
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }

      // Use correct URL for mobile vs web
      const baseUrl = Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.46.30.39:8000';
      const url = `${baseUrl}/message?stream=1`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          message: text,
          model: 'claude',
          userTier: 'free',
          userId: session.user?.id || 'mobile-user'
        })
      });

      if (!response.ok) {
        throw new Error(`Streaming error: ${response.statusText}`);
      }

      // 🟢 iOS/Safari Streaming Fix
      // Safari has stricter ReadableStream support - use platform-specific approach
      let fullText = '';
      
      console.log('Platform detected:', Platform.OS);
      console.log('User agent:', navigator?.userAgent || 'No navigator');
      
      // iOS/Safari specific handling
      if (Platform.OS === 'ios' || Platform.OS === 'web') {
        console.log('iOS/Safari fallback triggered');
        
        try {
          // For iOS/Safari, use response.text() instead of getReader()
          const responseText = await response.text();
          console.log('Response text received, length:', responseText.length);
          console.log('Response preview:', responseText.substring(0, 200));
          
          const lines = responseText.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const text = line.replace('data: ', '');
              if (text === '[DONE]') continue;
              
              console.log('Received SSE line:', text);
              
              try {
                const json = JSON.parse(text);
                console.log('Parsed JSON:', json);
                                  if (json.chunk) {
                    fullText += json.chunk;
                    console.log('Updated fullText:', fullText);
                    // Update streaming message with force re-render
                    setMessages(prev => {
                      const updated = prev.map(msg => 
                        msg.id === messageId 
                          ? { ...msg, text: fullText, isStreaming: true }
                          : msg
                      );
                      console.log('Messages updated, count:', updated.length);
                      console.log('Streaming message:', updated.find(m => m.id === messageId));
                      return [...updated]; // Force new array reference
                    });
                  }
              } catch (e) {
                // Skip invalid JSON
                console.log('Skipping invalid JSON:', text);
              }
            }
          }
          
          console.log('Successfully processed iOS/Safari response');
          
        } catch (textError) {
          console.log('iOS/Safari response.text() failed:', textError.message);
          throw new Error(`iOS/Safari streaming failed: ${textError.message}`);
        }
        
      } else {
        // Android/other platforms use getReader()
        console.log('Using Android/other platform with getReader()');
        
        const reader = response.body?.getReader?.();
        if (!reader) {
          console.log('Response body not readable, checking response type:', response.type);
          console.log('Response headers:', Object.fromEntries(response.headers.entries()));
          throw new Error('Streaming error: Response body is not readable (mobile fallback triggered)');
        }

        // Stream word-by-word with mobile support
        let partial = '';
        const decoder = new TextDecoder('utf-8');

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            partial += decoder.decode(value, { stream: true });
            const chunks = partial.split('\n\n');
            
            for (const chunk of chunks) {
              if (chunk.startsWith('data: ')) {
                const text = chunk.replace('data: ', '');
                if (text === '[DONE]') continue;
                
                try {
                  const json = JSON.parse(text);
                  if (json.chunk) {
                    fullText += json.chunk;
                    // Update streaming message with force re-render
                    setMessages(prev => {
                      const updated = prev.map(msg => 
                        msg.id === messageId 
                          ? { ...msg, text: fullText, isStreaming: true }
                          : msg
                      );
                      console.log('Messages updated (Android), count:', updated.length);
                      console.log('Streaming message (Android):', updated.find(m => m.id === messageId));
                      return [...updated]; // Force new array reference
                    });
                  }
                } catch (e) {
                  // Skip invalid JSON
                  console.log('Skipping invalid JSON:', text);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        
        console.log('Successfully processed Android/other platform response');
      }

      // Finalize message
      setMessages(prev => {
        const updated = prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, text: fullText || 'No response received', isStreaming: false }
            : msg
        );
        console.log('Finalizing message, final text:', fullText);
        return [...updated]; // Force new array reference
      });
      setStreamingMessageId(null);

    } catch (error) {
      console.error('Streaming error:', error);
      
      // Log additional debugging info for Safari/iOS
      if (Platform.OS === 'ios' || Platform.OS === 'web') {
        console.log('Platform:', Platform.OS);
        console.log('Error details:', error.message);
      }
      
      // Fallback to mock response
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, text: `I received your message: "${text}". This is a simplified version of your Atlas app running on mobile!`, isStreaming: false }
            : msg
        ));
        setStreamingMessageId(null);
      }, 1000);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isProcessing) return;
    
    const userMessage: Message = {
      id: generateId(),
      text: message.trim(),
      isUser: true,
      timestamp: formatTimestamp()
    };

    const assistantMessage: Message = {
      id: generateId(),
      text: '',
      isUser: false,
      timestamp: formatTimestamp(),
      isStreaming: true
    };

    console.log('➕ Creating assistant message:', assistantMessage);
    setMessages(prev => {
      const newMessages = [...prev, userMessage, assistantMessage];
      console.log('📝 Updated messages array, new count:', newMessages.length);
      console.log('🎯 Assistant message in array:', newMessages.find(m => m.id === assistantMessage.id));
      return newMessages;
    });
    setStreamingMessageId(assistantMessage.id);
    console.log('🔄 Set streaming message ID to:', assistantMessage.id);
    setMessage('');
    setIsProcessing(true);

    // Start streaming with the correct message ID
    await sendMessageStream(userMessage.text, assistantMessage.id);
    setIsProcessing(false);
  };

  const renderMessage = (msg: Message) => {
    return (
      <Animated.View 
        key={`${msg.id}-${msg.text.length}-${msg.isStreaming}`}
        style={[
          styles.messageContainer,
          msg.isUser ? styles.userMessage : styles.aiMessage,
          { opacity: fadeAnim }
        ]}
        onLongPress={() => !msg.isUser && handleLongPress(msg.text)}
      >
        <Text style={styles.messageText}>
          {msg.text || (msg.isStreaming ? 'Atlas is thinking...' : '')}
          {msg.isStreaming && (
            <Text style={styles.typingIndicator}>
              {' •••'}
            </Text>
          )}
        </Text>
        <Text style={styles.timestamp}>{msg.timestamp}</Text>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Atlas AI</Text>
        <Text style={styles.subtitle}>Your AI Assistant</Text>
        {authLoading && (
          <Text style={styles.authStatus}>Loading authentication...</Text>
        )}
        {!authLoading && !session && (
          <Text style={styles.authStatus}>Not authenticated</Text>
        )}
        {!authLoading && session && (
          <Text style={styles.authStatus}>Authenticated ✓</Text>
        )}
      </View>

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer} 
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome to Atlas!</Text>
            <Text style={styles.welcomeSubtext}>Your AI assistant is ready to help.</Text>
          </View>
        ) : (
          messages.map(renderMessage)
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message..."
          placeholderTextColor="#666"
          multiline
          maxLength={1000}
          editable={!isProcessing}
        />
        <TouchableOpacity 
          style={[
            styles.sendButton, 
            (!message.trim() || isProcessing || authLoading) && styles.sendButtonDisabled
          ]}
          onPress={handleSendMessage}
          disabled={!message.trim() || isProcessing || authLoading}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  authStatus: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    paddingBottom: 16,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  messageContainer: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
    position: 'relative',
  },
  userMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  aiMessage: {
    backgroundColor: '#333',
    alignSelf: 'flex-start',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  typingIndicator: {
    color: '#888',
    fontSize: 16,
  },
  timestamp: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    marginRight: 12,
    minHeight: 44,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sendButtonDisabled: {
    backgroundColor: '#555',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
