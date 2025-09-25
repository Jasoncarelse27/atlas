import type { User } from '@supabase/supabase-js';
import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useConversations } from './hooks/useConversations';
import { useCustomization } from './hooks/useCustomization';
import { useSoundEffects } from './hooks/useSoundEffects';
import { useSubscription } from './hooks/useSubscription';
import useThemeMode from './hooks/useThemeMode';
import { useTierAccess } from './hooks/useTierAccess';
import useVoiceRecognition from './hooks/useVoiceRecognition';
import { supabase } from './lib/supabase';
import { syncPendingUploads, testBackendConnection } from './services/syncService';
import type { Message } from './types/chat';

// 🚨 CONFIG GUARD: Ensure VITE_API_URL is set
if (!import.meta.env.VITE_API_URL) {
  console.error('❌ Missing VITE_API_URL. Please set it in .env.local before running Atlas.');
  console.error('   Example: VITE_API_URL=https://atlas-production-2123.up.railway.app');
  throw new Error('VITE_API_URL environment variable is required');
}

// Components
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import DebugPage from './pages/DebugPage';
import DebugProfile from './pages/DebugProfile';
import EnhancedUIDemo from './pages/EnhancedUIDemo';
import PaddleTestPage from './pages/PaddleTestPage';

// Create a client
const queryClient = new QueryClient()

// App content component that uses React Query hooks
function AppContent() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showWidgets, setShowWidgets] = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);
  const [showTestingPanel, setShowTestingPanel] = useState(false);
  const [showDashboardTester, setShowDashboardTester] = useState(false);
  
  // 🎯 TIER ENFORCEMENT: Add tier access hooks
  const { tier, canUseFeature } = useTierAccess(user?.id);
  
  // Get model name from tier
  const getClaudeModelName = (tier: string) => {
    switch (tier) {
      case 'studio': return 'claude-3-opus-20240229';
      case 'core': return 'claude-3.5-sonnet-20240620';
      case 'free':
      default: return 'claude-3-haiku-20240307';
    }
  };
  
  const model = getClaudeModelName(tier);
  const claudeModelName = getClaudeModelName(tier);
  const canStartConversation = canUseFeature('text');
  const [messageCount, setMessageCount] = useState(0);
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
  
  const { profile = mockProfile, refresh: refreshProfile } = useSubscription(user?.id);
  
  // Customization hook (currently unused but available for future features)
  useCustomization(user);

  // Sound effects
  const { 
    playSound,
    soundTheme
  } = useSoundEffects();

  // Theme mode
  useThemeMode();

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
  
  // 🧠 SIMPLE MEMORY: Direct conversation ID management
  const [atlasConversationId, setAtlasConversationId] = useState<string | null>(() => {
    // Load from localStorage on startup
    const saved = localStorage.getItem('atlas_conversation_id');
    if (saved) {
      console.log('🧠 [STARTUP] Loaded conversation ID from storage:', saved);
    }
    return saved;
  });
  
  // Update conversation ID with localStorage persistence
  const saveConversationId = (id: string | null) => {
    console.log('🧠 [MEMORY] Saving conversation ID:', id);
    setAtlasConversationId(id);
    
    if (id) {
      localStorage.setItem('atlas_conversation_id', id);
      console.log('💾 [MEMORY] Persisted to localStorage:', id);
    } else {
      localStorage.removeItem('atlas_conversation_id');
      console.log('🗑️ [MEMORY] Cleared from localStorage');
    }
  };
  
  // Start new chat function
  const startNewChat = () => {
    console.log('🆕 [FRONTEND] Starting new chat');
    
    // Clear stored conversation ID
    localStorage.removeItem("atlas_conversation_id");
    console.log("🗑️ [FRONTEND] Cleared conversationId — starting fresh");
    
    // Clear UI conversations
    clearConversations();
  };

  // Refs 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper function to handle auth errors and force logout
  const handleAuthError = (error: any) => {
    console.error('Authentication error:', error);
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

  // Viewport height fix for mobile browsers
  useEffect(() => {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Set initial viewport height
    setViewportHeight();

    // Update on resize (including mobile keyboard open/close)
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);

  // Load auth state
  useEffect(() => {
    const loadUser = async () => {
      try {
        setIsAuthLoading(true);
        
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth timeout')), 3000)
        );
        
        const authPromise = supabase.auth.getSession();
        
        const result = await Promise.race([authPromise, timeoutPromise]) as any;
        const { data: { session }, error } = result;
        
        if (error) {
          console.log('Auth error:', error.message);
          // If it's a refresh token error, clear the session
          if (error.message.includes('Invalid Refresh Token') || error.message.includes('Refresh Token Not Found')) {
            console.log('Clearing invalid session...');
            await supabase.auth.signOut();
            setUser(null);
          }
        } else if (session?.user) {
          setUser(session.user);
          console.log('User loaded:', session.user.email);
        } else {
          console.log('No user session found');
        }
      } catch (error) {
        console.log('Auth loading failed:', error);
      } finally {
        setIsAuthLoading(false);
        console.log('Auth loading completed');
      }
    };
    
    loadUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event);
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 🔄 Debounced backend sync for upload retries
  const debouncedSyncUploads = useMemo(
    () =>
      debounce(async () => {
        const ok = await testBackendConnection();
        if (ok) {
          console.log("✅ Backend reachable, syncing pending uploads...");
          await syncPendingUploads(); // Dexie flush + Edge retry
        }
      }, 30000), // 30 second debounce
    []
  );

  // Check connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Connection test removed - using simplified Supabase client

        // Test backend connection (use local in development)
        try {
          console.log('🚀 Testing backend connection...');
          const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
          const response = await fetch(`${backendUrl}/ping`, {
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
            console.log('✅ Backend is alive:', data);
            console.log(`📊 Backend response time: ${Date.now() - Date.now()}ms`);
            
            // 🔄 Trigger debounced upload sync when backend is available
            debouncedSyncUploads();
          } else {
            console.warn('⚠️ Backend responded with error:', response.status, response.statusText);
          }
        } catch (backendError) {
          console.warn('⚠️ Backend test failed:', backendError);
          console.log('💡 Backend may be down or not started yet');
        }
      } catch (error) {
        console.error('❌ Connection test error:', error); 
        
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

  // Message handling is now done by ChatPage.tsx using useMessageStore
  // This function is kept for backward compatibility but does nothing
  const handleSendMessage = async (message: string) => {
    console.log('⚠️ App.tsx handleSendMessage called - this should be handled by ChatPage.tsx');
    // Do nothing - ChatPage.tsx handles all message sending now
    return;
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
      console.log('Upgrade completed for tier:', tier);
      playSound('success');
    }, 1000);
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
    <Router>
      <Toaster position="top-center" />
      <Routes>
        {/* Always use your custom AuthPage for /login */}
        <Route path="/login" element={<AuthPage />} />
        {/* Redirect dashboard to chat - unified experience */}
        <Route path="/dashboard" element={<Navigate to="/chat" replace />} />
        <Route
          path="/chat"
          element={user ? <ChatPage user={user} /> : <Navigate to="/login" replace />}
        />
        {/* Default route redirects to chat */}
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route
          path="/demo"
          element={<EnhancedUIDemo />}
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
          path="/paddle-test"
          element={user ? <PaddleTestPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="*"
          element={user ? <Navigate to="/chat" replace /> : <Navigate to="/login" replace />}
        />
      </Routes>
      
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;