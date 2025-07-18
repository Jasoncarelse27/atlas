import React, { useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, testConnection } from './lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useSubscription } from './hooks/useSubscription';
import { useCustomization } from './hooks/useCustomization';
import { useSoundEffects } from './hooks/useSoundEffects';
     import useThemeMode from './hooks/useThemeMode';
import useVoiceRecognition from './hooks/useVoiceRecognition';
import { useConversations } from './hooks/useConversations';
import type { Message, Conversation } from './types/chat';

// Components
import SimplifiedHeader from './components/SimplifiedHeader';
import SideMenu from './components/SideMenu';
import Background from './components/Background';
import MainInteractionArea from './components/MainInteractionArea';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from "./components/ErrorMessage";
import UpgradeModal from './components/UpgradeModal';
import PaymentSuccessModal from './components/PaymentSuccessModal';
import WidgetSystem from './components/WidgetSystem';
import ControlCenter from './components/ControlCenter';
import TestingPanel from './components/TestingPanel';
import DashboardTester from './components/DashboardTester';
import NetworkCheckModal from './components/NetworkCheckModal';
import SpeedTestModal from './components/SpeedTestModal';
import ConversationView from './components/ConversationView';
import ConversationHistoryPanel from './components/ConversationHistoryPanel'; 
import AccountModal from './components/AccountModal';
import UnifiedInputBar from './components/UnifiedInputBar';
import AuthPage from './pages/AuthPage';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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
    tier: 'pro',
    trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: 'active',
    subscription_id: 'mock-subscription-id',
    usage_stats: {
      requests_this_month: 45,
      audio_minutes_this_month: 12,
      storage_used_mb: 250,
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
        const result = await testConnection();
         
        if (result.success) {
          console.log('✅ Connection test successful');
          setConnectionStatus('online');
        } else {
          console.warn('⚠️ Connection test failed:', result.error);
          setConnectionStatus('offline');
          
          // Check if the error is authentication-related 
          if (result.error?.includes('Authentication failed') || 
              result.error?.includes('Invalid Refresh Token') ||
              result.error?.includes('refresh_token_not_found')) {
            handleAuthError(result.error);
          }
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
      // Send message to N8n webhook
      console.log('📤 Sending message to N8n webhook:', message);
      
      // Use Supabase Edge Function to proxy the request to N8n
      const n8nProxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/n8n-proxy`;
      
      const response = await fetch(n8nProxyUrl, { 
        method: 'POST',
          headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          message: message,
          user_id: user?.id,
          conversation_id: conversationToUse.id,
          metadata: {
            timestamp: new Date().toISOString()
          }
        })
      });
       
      if (!response.ok) {
        throw new Error(`N8n webhook failed with status ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('📥 Received response from N8n:', responseData);
      
      // Check if we have a valid response 
      if (!responseData.response) {
        throw new Error('No response received from N8n');
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
    <>
      <div className="bg-red-500 text-white p-4 text-2xl">Tailwind Test</div>
      <Router>
        <Routes>
          {/* Always use your custom AuthPage for /login */}
          <Route path="/login" element={<AuthPage />} />
          <Route
            path="*"
            element={user ? (
              // Main app content goes here (the rest of your App JSX)
              <>
                {/* Place your main app JSX here, e.g. headers, menus, main content, etc. */}
                {/* ...existing main app code... */}
              </>
            ) : (
              <Navigate to="/login" replace />
            )}
          />
        </Routes>
      </Router>
    </>
  );
}

export default App;