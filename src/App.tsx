import type { User } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useConversations } from './hooks/useConversations';
import { useCustomization } from './hooks/useCustomization';
import { useSoundEffects } from './hooks/useSoundEffects';
import { useSubscription } from './hooks/useSubscription';
import useThemeMode from './hooks/useThemeMode';
import useVoiceRecognition from './hooks/useVoiceRecognition';
import { supabase } from './lib/supabase';
import type { Message } from './types/chat';

// Initialize Sentry for web
if (typeof window !== "undefined") {
  import("./monitoring/sentry.web");
}

// Components
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import { useMessages } from './features/chat/hooks/useMessages';
import { queryClient } from './features/chat/lib/queryClient';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import DashboardPage from './pages/DashboardPage';
import DebugPage from './pages/DebugPage';
import DebugProfile from './pages/DebugProfile';

function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
  
  // UI state
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [showWidgets, setShowWidgets] = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);
  const [showTestingPanel, setShowTestingPanel] = useState(false);
  const [showDashboardTester, setShowDashboardTester] = useState(false);
  const [showNetworkCheck, setShowNetworkCheck] = useState(false);
  const [showSpeedTest, setShowSpeedTest] = useState(false);
  const [showConversationHistoryModal, setShowConversationHistoryModal] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [upgradeSelectedTier, setUpgradeSelectedTier] = useState<string>('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  
  // Subscription and customization
  // Create a mock profile
  const mockProfile = {
    id: 'mock-user-id',
    tier: 'free',
    trial_ends_at: null,
    subscription_status: 'active',
    subscription_id: null,
    usage_stats: {
      mood_tracking_days: 15,
      emotional_insights_this_month: 2,
      journal_entries_this_month: 3,
      ai_prompts_this_month: 12,
      streak_days: 5,
      last_reset_date: new Date().toISOString().slice(0, 7)
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as const;
  
  const { profile = mockProfile } = useSubscription(user);
  
  const { 
    customization,
    updateCustomization,
    isLoading: isCustomizationLoading 
  } = useCustomization(user);

  // Sound effects
  const { 
    playSound,
    soundTheme
  } = useSoundEffects();

  // Theme mode
  const { 
    themeMode, 
    setTheme,
    isDarkMode
  } = useThemeMode();

  // Conversation state
  const {
    conversations,
    currentConversation,
    createConversation,
    selectConversation,
    addMessageToConversation,
    updateConversationTitle,
    deleteConversation,
    clearConversations
  } = useConversations(user);

  // Messages service hook (for future integration)
  const { list: messagesQuery, send: sendMessage } = useMessages(currentConversation?.id || '');

  // Refs 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper function to handle auth errors and force logout
  const handleAuthError = (error: any) => {
    console.error('Authentication error:', error);
    setAuthError('Authentication failed. Please log in again.');
    setUser(null);
  };

  // Interaction state
  const [mode, setMode] = useState<'text' | 'voice' | 'image'>('text');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageAnalysisResult, setImageAnalysisResult] = useState<any>(null);
  
  // Voice settings
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  // Voice recognition
  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useVoiceRecognition();

  // Load auth state
  useEffect(() => {
    const loadUser = async () => {
      try {
        setIsAuthLoading(true);
        setAuthError(null);
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          setAuthError(error.message);
          return;
        }
        if (session?.user) {
          setUser(session.user);
        }
      } catch (error) {
        setAuthError('Failed to load user session');
      } finally {
        setIsAuthLoading(false);
      }
    };
    loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setAuthError(null);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setAuthError(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Set isAuthLoading to false since we're bypassing auth
  useEffect(() => {
    setIsAuthLoading(false);
  }, []);

  // Check connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        setConnectionStatus('connecting');
        // Connection test removed - using simplified Supabase client
        setConnectionStatus('online');

        // Test Railway backend connection
        try {
          console.log('🚀 Testing Railway backend connection...');
          const railwayUrl = 'https://atlas-production-14090287.up.railway.app';
          const response = await fetch(`${railwayUrl}/ping`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'User-Agent': 'Atlas-App/1.0'
            },
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Railway backend is alive:', data);
            console.log(`📊 Backend uptime: ${data.uptime?.toFixed(2)}s`);
          } else {
            console.warn('⚠️ Railway backend responded with error:', response.status, response.statusText);
          }
        } catch (railwayError) {
          console.warn('⚠️ Railway backend test failed:', railwayError);
          console.log('💡 Railway backend may be down or not deployed yet');
        }
      } catch (error) {
        console.error('❌ Connection test error:', error); 
        setConnectionStatus('offline');
        
        // Check if the error is authentication-related
        if (error instanceof Error && 
            (error.message.includes('Authentication failed') || 
             error.message.includes('Invalid Refresh Token') ||
             error.message.includes('refresh_token_not_found'))) {
          handleAuthError(error);
        }
      }
    };

    if (user) {
      checkConnection();
      // Periodically check connection status
      const interval = setInterval(checkConnection, 60000); // Check every minute
      
      return () => clearInterval(interval); 
    }
  }, [user]);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
       
      if (availableVoices.length > 0) {
        // Filter for high-quality voices
        const englishVoices = availableVoices.filter(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Premium'))
        );
        
        const voicesToUse = englishVoices.length > 0 ? englishVoices : availableVoices; 
        setVoices(voicesToUse);
        
        // Set default voice
        const defaultVoice = voicesToUse.find(voice => 
          voice.name.includes('Google') || voice.name.includes('Natural')
        );
        
        if (defaultVoice) {
          setCurrentVoice(defaultVoice);
        } else if (voicesToUse.length > 0) {
          setCurrentVoice(voicesToUse[0]);
        } 
      }
    };

    loadVoices();
    
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []); 

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentConversation?.messages]);
  
  // Handle voice input
  const handleVoiceStart = () => {
    if (isProcessing) return;
    
    resetTranscript();
    startListening();
  };
  
  const handleVoiceEnd = () => {
    if (isProcessing) return;
    
    stopListening();
    
    if (transcript.trim()) {
      handleSendMessage(transcript);
    }
  };
  
  // Handle text input
  const handleTextInput = (message: string) => {
    if (isProcessing || !message.trim()) return;
    
    handleSendMessage(message);
  };

  // Handle image input 
  const handleImageSelect = (file: File) => {
    if (isProcessing) return;
    
    setImageAnalysisResult(null);
    setIsProcessing(true);
    
    // Simulate image analysis
    setTimeout(() => { 
      const mockResult = {
        objects: [
          { label: 'Person', confidence: 0.98 },
          { label: 'Building', confidence: 0.85 },
          { label: 'Tree', confidence: 0.76 }
        ],
        tags: ['outdoor', 'sunny', 'architecture', 'urban'],
        text: 'Sample text extracted from image',
        description: 'An image showing a person standing in front of a modern building with trees nearby.'
      };
       
      setImageAnalysisResult(mockResult);
      setIsProcessing(false);
      
      // Create or get current conversation
      let conversationToUse = currentConversation;
      if (!conversationToUse) {
        conversationToUse = createConversation();
        console.log('Created new conversation for image analysis:', conversationToUse.id); 
      }
      
      // Create user message
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: 'Please analyze this image',
        timestamp: new Date().toISOString(),
        imageUrl: URL.createObjectURL(file)
      };
       
      // Create assistant response
      const responseMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: `I've analyzed the image and found the following:\n\n- Objects: Person (98% confidence), Building (85% confidence), Tree (76% confidence)\n- Tags: outdoor, sunny, architecture, urban\n- Text content: "${mockResult.text}"\n\nDescription: ${mockResult.description}`,
        timestamp: new Date().toISOString()
      };
       
      // Add messages to conversation
      try {
        addMessageToConversation(conversationToUse.id, userMessage);
        addMessageToConversation(conversationToUse.id, responseMessage);
      } catch (error) {
        console.error('Error adding messages to conversation:', error);
      }
       
      setResponse(responseMessage.content);
    }, 3000);
  };

  // Handle sending message to backend
  const handleSendMessage = async (message: string) => {
    if (isProcessing || !message.trim()) return;
     
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
      
      // Use local backend
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/message?stream=1`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-development`
        },
        body: JSON.stringify({
          message: message,
          conversationId: conversationToUse.id
        })
      });
       
      if (!response.ok) {
        throw new Error(`Backend failed with status ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('📥 Received response from backend:', responseData);
      
      // Check if we have a valid response 
      if (!responseData.response || !responseData.response.content) {
        throw new Error('No response received from backend');
      }
      
      // Add assistant response to conversation
      const assistantMessage: Message = {
        id: responseData.response.id || uuidv4(),
        role: 'assistant',
        content: responseData.response.content.text || responseData.response.content,
        timestamp: responseData.response.timestamp || new Date().toISOString(),
        audioUrl: responseData.response.audioUrl
      };
       
      try {
        addMessageToConversation(conversationToUse.id, assistantMessage);
      } catch (error) {
        console.error('Error adding assistant message to conversation:', error);
      }
      
      setResponse(responseData.response.content.text || responseData.response.content);
      setAudioUrl(responseData.audioUrl); 
      
      // Play success sound
      playSound('success');
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Play error sound 
      playSound('error');
      
      // Add error message to conversation
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      };
       
      try {
        addMessageToConversation(conversationToUse.id, errorMessage);
      } catch (error) {
        console.error('Error adding error message to conversation:', error);
      }
      
      setResponse(errorMessage.content);
       
    } finally {
      setIsProcessing(false);
      resetTranscript();
    }
  };

  // Handle mode change
  const handleModeChange = (newMode: 'text' | 'voice' | 'image') => {
    setMode(newMode);
    resetTranscript();
    setResponse(''); 
    setAudioUrl(null);
    
    // Play mode change sound
    playSound('click');
  };

  // Handle voice change
  const handleVoiceChange = (voice: SpeechSynthesisVoice) => {
    setCurrentVoice(voice);
  };

  // Handle mute toggle 
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (playSound) playSound('toggle');
  };

  // Handle logout
  const handleLogout = async () => {
    try { 
      await supabase.auth.signOut();
      setUser(null);
      setAuthError(null);
      
      // Clear local state
      setResponse('');
      setAudioUrl(null);
      
      playSound('click');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Handle upgrade
  const handleUpgrade = (tier: string) => { 
    console.log('Upgrading to tier:', tier);
    setUpgradeSelectedTier(tier);
    
    // Simulate upgrade process
    setTimeout(() => {
      setShowUpgradeModal(false);
      setShowPaymentSuccess(true);
      playSound('success');
      
      // Hide success modal after 3 seconds
      setTimeout(() => {
        setShowPaymentSuccess(false);
      }, 3000);
    }, 1000);
  };

  // Alternative message sending using useMessages hook (for future integration)
  const handleSendMessageWithService = async (message: string) => {
    if (isProcessing || !message.trim() || !currentConversation) return;
    
    setIsProcessing(true);
    try {
      await sendMessage.mutateAsync(message);
      playSound('success');
    } catch (error) {
      console.error('Error sending message with service:', error);
      playSound('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle message deletion 
  const handleDeleteMessage = (id: string) => {
    // This would need to be implemented in the useConversations hook
    // For now, we'll just log it
    console.log('Delete message:', id);
    playSound('click');
  };

  // Handle message copy 
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    playSound('click');
  };

  // Handle new conversation
  const handleNewConversation = () => {
    createConversation();
    playSound('click');
  };

  // Handle conversation title update 
  const handleUpdateConversationTitle = (title: string) => {
    if (currentConversation) {
      updateConversationTitle(currentConversation.id, title);
      playSound('click');
    }
  };

  // Handle voice settings
  const handleShowVoiceSettings = () => {
    if (playSound) playSound('modal_open');
    setShowVoiceSettings(true);
  };

  const handleCloseVoiceSettings = () => {
    if (playSound) playSound('modal_close');
    setShowVoiceSettings(false);
  };

  // Loading state 
  if (isAuthLoading) {
    return <LoadingSpinner />;
  }

  return (
    <QueryClientProvider client={queryClient}>
        <Router>
          <Toaster position="top-center" />
          <Routes>
            {/* Always use your custom AuthPage for /login */}
            <Route path="/login" element={<AuthPage />} />
            <Route
              path="/chat"
              element={user ? <ChatPage user={user} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/dashboard"
              element={user ? <DashboardPage user={user} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/debug"
              element={user ? <DebugPage user={user} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/debug-profile"
              element={user ? <DebugProfile user={user} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="*"
              element={user ? <Navigate to="/chat" replace /> : <Navigate to="/login" replace />}
            />
          </Routes>
        </Router>
      </QueryClientProvider>
  );
}

export default App;