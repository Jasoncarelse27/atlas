import type { User } from '@supabase/supabase-js';
import { Brain, LogOut, Settings, User as UserIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

// Hooks
import { useConversations } from '../hooks/useConversations';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useSubscription } from '../hooks/useSubscription';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import { supabase } from '../lib/supabase';
import type { Message } from '../types/chat';

// Components
import ControlCenter from '../components/ControlCenter';
import MainInteractionArea from '../components/MainInteractionArea';
import ConversationView from '../features/chat/components/ConversationView';
import { useCustomization } from '../hooks/useCustomization';

interface ChatPageProps {
  user: User;
}

const ChatPage: React.FC<ChatPageProps> = ({ user }) => {
  const navigate = useNavigate();

  // Create a mock profile for now
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

  // Sound effects
  const { playSound } = useSoundEffects();
  
  // Customization
  const { customization } = useCustomization(user);

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

  // Interaction state
  const [mode, setMode] = useState<'text' | 'voice' | 'image'>('text');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageAnalysisResult, setImageAnalysisResult] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'connecting'>('online');
  const [showControlCenter, setShowControlCenter] = useState(false);
  
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

  // Refs 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
       
      if (availableVoices.length > 0) {
        const englishVoices = availableVoices.filter(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Premium'))
        );
        
        const voicesToUse = englishVoices.length > 0 ? englishVoices : availableVoices; 
        setVoices(voicesToUse);
        
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
      conversationToUse = createConversation();
      try { 
        addMessageToConversation(conversationToUse.id, userMessage);
      } catch (fallbackError) {
        setIsProcessing(false);
        return;
      }
    }
     
    try {
      // Send message to local backend
      console.log('📤 Sending message to local backend:', message);
      
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
      
      playSound('success');
      
    } catch (error) {
      console.error('Error sending message:', error);
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
      navigate('/login');
      playSound('click');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Atlas AI
              </span>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center space-x-2 bg-gray-700/50 rounded-lg p-1">
              {(['text', 'voice', 'image'] as const).map((modeOption) => (
                <button
                  key={modeOption}
                  onClick={() => handleModeChange(modeOption)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    mode === modeOption
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  }`}
                >
                  {modeOption.charAt(0).toUpperCase() + modeOption.slice(1)}
                </button>
              ))}
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowControlCenter(true)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium">{user?.email}</span>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-red-600 transition-colors bg-red-500/20 hover:bg-red-500/30"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Conversations</h3>
              <div className="space-y-3">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      currentConversation?.id === conv.id
                        ? 'bg-blue-600/30 border border-blue-500'
                        : 'hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-sm font-medium truncate">{conv.title}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {conv.messages.length} messages
                    </div>
                  </button>
                ))}
                
                <button
                  onClick={createConversation}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors border-2 border-dashed border-gray-600"
                >
                  + New Conversation
                </button>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden h-[calc(100vh-12rem)]">
              {currentConversation ? (
                <div className="h-full flex flex-col">
                  {/* Conversation Messages */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <ConversationView
                      conversation={currentConversation}
                      onDeleteMessage={(id) => {
                        // TODO: Implement message deletion
                        console.log('Delete message:', id);
                      }}
                      onCopyMessage={(content) => {
                        navigator.clipboard.writeText(content);
                      }}
                      onUpdateTitle={(title) => {
                        updateConversationTitle(currentConversation.id, title);
                      }}
                      messagesEndRef={messagesEndRef}
                    />
                  </div>
                  
                  {/* Main Interaction Area */}
                  <div className="border-t border-gray-700">
                    <MainInteractionArea
                      mode={mode}
                      isProcessing={isProcessing}
                      response={response}
                      audioUrl={audioUrl}
                      imageAnalysisResult={imageAnalysisResult}
                      transcript={transcript}
                      isListening={isListening}
                      voices={voices}
                      currentVoice={currentVoice}
                      isMuted={isMuted}
                      onVoiceStart={handleVoiceStart}
                      onVoiceEnd={handleVoiceEnd}
                      onTextInput={handleTextInput}
                      onImageSelect={handleImageSelect}
                      onVoiceChange={handleVoiceChange}
                      onMuteToggle={handleMuteToggle}
                      onSoundPlay={playSound}
                      browserSupportsSpeechRecognition={browserSupportsSpeechRecognition}
                      connectionStatus={connectionStatus}
                      onShowVoiceSettings={() => console.log('Show voice settings')}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-300 mb-2">
                      Welcome to Atlas AI
                    </h3>
                    <p className="text-gray-400 mb-6">
                      Start a new conversation to begin chatting with your AI assistant.
                    </p>
                    <button
                      onClick={createConversation}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                    >
                      Start New Conversation
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Control Center Modal */}
      <ControlCenter
        isOpen={showControlCenter}
        onClose={() => setShowControlCenter(false)}
      />
    </div>
  );
};

export default ChatPage;
