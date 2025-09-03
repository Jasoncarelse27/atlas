import React, { useState, useEffect, useRef } from 'react';

// Type definitions
interface User {
  id: string;
  email: string;
  name: string;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    provider: string;
    confidence: number;
    responseTime: number;
    cached: boolean;
  };
}

const AtlasApp = () => {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<User | null>(null);

  // App state
  const [currentMode, setCurrentMode] = useState('voice');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // AI Brain state
  const [personality, setPersonality] = useState('supportive');
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Simple login function
  const doLogin = () => {
    if (email.length > 0 && password.length > 0) {
      const newUser: User = {
        id: '1',
        email: email,
        name: email.split('@')[0] || 'User'
      };
      setUser(newUser);
      setIsLoggedIn(true);
      
      // Add welcome message
      setTimeout(() => {
        addMessage('assistant', "Welcome to Atlas! I'm your premium AI companion with advanced personality adaptation and emotional intelligence. How can I assist you today?");
      }, 1000);
    }
  };

  // Add message to conversation
  const addMessage = (role: 'user' | 'assistant', content: string, metadata = {}) => {
    const message: Message = {
      id: Date.now() + Math.random(),
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata: {
        provider: 'Claude Sonnet 4',
        confidence: 0.96,
        responseTime: Math.round(Math.random() * 400 + 300),
        cached: Math.random() > 0.8,
        ...metadata
      }
    };
    setMessages(prev => [...prev, message]);
  };

  // AI Brain response generator with personality
  const generateAIResponse = (message: string, personality: string, emotion: string) => {
    const responses = {
      supportive: {
        happy: "I can feel your positive energy! Let's channel that enthusiasm into something amazing. Your joy is absolutely contagious.",
        stressed: "I understand you're feeling overwhelmed right now. Take a deep breath with me - we'll work through this together, one step at a time.",
        focused: "I love seeing you in this productive flow state! Let's harness this incredible momentum and achieve something extraordinary.",
        curious: "Your curiosity is absolutely fascinating! I'm excited to explore this topic with you and uncover some amazing insights together.",
        neutral: "I'm here to support you with whatever you need. Think of me as your dedicated AI partner, ready to adapt to your unique style."
      },
      professional: {
        happy: "Excellent mindset for our collaboration. Your positive approach will significantly enhance our productivity and outcomes today.",
        stressed: "I recognize the pressure you're experiencing. Let's implement a structured, systematic approach to efficiently address your priorities.",
        focused: "Your commitment to excellence is commendable. I'll provide precise, actionable insights to maximize your productivity.",
        curious: "Your analytical inquiry demonstrates sophisticated thinking. I'll deliver comprehensive, data-driven insights to support your objectives.",
        neutral: "I'm prepared to provide strategic guidance and professional insights tailored to your specific requirements and goals."
      },
      creative: {
        happy: "Your joy is like pure creative energy radiating through our conversation! Let's paint this moment with vibrant possibilities and bold ideas.",
        stressed: "Think of this pressure as raw creative material - we're sculpting something beautiful from this intensity. Every challenge becomes art.",
        focused: "You're in the magical zone where innovation flows like a river! Let's ride this creative wave and manifest something extraordinary.",
        curious: "Your mind is opening doorways to infinite possibilities! Let's dive into the rabbit hole of wonder and discover hidden treasures.",
        neutral: "We're standing at the edge of a blank canvas, ready to create something that's never existed before. What shall we dream into reality?"
      },
      casual: {
        happy: "Dude, your energy is absolutely infectious! I'm totally here for this vibe - let's keep this positive momentum rolling.",
        stressed: "Hey, I totally get it - we all have those overwhelming moments. Let's just take it easy and figure this out together, no pressure.",
        focused: "Love seeing you in the zone! You're absolutely crushing it right now. Let's keep this productive energy flowing.",
        curious: "Oh, this is super interesting! I love when conversations take these fascinating turns. Let's dive deep into this together.",
        neutral: "Hey there! I'm genuinely excited to chat with you today. What's on your mind? I'm here to help however I can."
      }
    };

    return responses[personality][emotion] || responses[personality].neutral;
  };

  // Handle sending message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    const userMessage = inputMessage;
    setInputMessage('');
    setIsProcessing(true);

    // Add user message
    addMessage('user', userMessage);

    // Simulate AI processing with realistic delay
    setTimeout(() => {
      const aiResponse = generateAIResponse(userMessage, personality, currentEmotion);
      addMessage('assistant', aiResponse);
      setIsProcessing(false);

      // Auto-speak if enabled
      if (autoSpeak && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(aiResponse);
        utterance.rate = personality === 'creative' ? 1.1 : personality === 'professional' ? 1.0 : 0.95;
        utterance.pitch = currentEmotion === 'happy' ? 1.1 : currentEmotion === 'stressed' ? 0.9 : 1.0;
        setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        speechSynthesis.speak(utterance);
      }
    }, 1200 + Math.random() * 800);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get emotion data
  const emotions = [
    { id: 'happy', emoji: '😊', label: 'Happy', color: 'from-yellow-400 to-orange-500' },
    { id: 'neutral', emoji: '😐', label: 'Neutral', color: 'from-gray-400 to-gray-500' },
    { id: 'focused', emoji: '🎯', label: 'Focused', color: 'from-blue-400 to-indigo-500' },
    { id: 'curious', emoji: '🤔', label: 'Curious', color: 'from-purple-400 to-pink-500' },
    { id: 'stressed', emoji: '😤', label: 'Stressed', color: 'from-red-400 to-pink-500' },
  ];

  // Login screen - Responsive
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 md:w-72 md:h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute top-3/4 right-1/4 w-32 h-32 md:w-72 md:h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute bottom-1/4 left-1/2 w-32 h-32 md:w-72 md:h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>
        
        <div className="relative z-10 bg-white/[0.08] backdrop-blur-2xl rounded-3xl p-6 md:p-8 w-full max-w-md border border-white/20 shadow-2xl">
          <div className="text-center mb-6 md:mb-8">
            {/* Logo with premium styling */}
            <div className="relative mb-4 md:mb-6">
              <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center shadow-2xl">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-white/20 to-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <span className="text-xl md:text-2xl">🧠</span>
                </div>
              </div>
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl opacity-20 blur-lg"></div>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-light text-white mb-2 tracking-tight">Atlas</h1>
            <p className="text-white/70 text-base md:text-lg font-light">Advanced AI Intelligence</p>
            <div className="mt-3 md:mt-4 flex justify-center">
              <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-blue-500 text-white text-xs font-medium rounded-full">
                Premium Edition
              </span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="relative">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 md:py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm text-sm md:text-base"
              />
            </div>
            
            <div className="relative">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 md:py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm text-sm md:text-base"
              />
            </div>
            
            <button
              onClick={doLogin}
              className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-3 md:py-4 px-6 rounded-2xl font-medium transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98] hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-sm md:text-base"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Continue to Atlas
              </span>
            </button>
          </div>
          
          <div className="mt-4 md:mt-6 text-center">
            <p className="text-white/50 text-sm">
              Use any email and password to continue
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main app - Responsive design
  return (
    <div className={`min-h-screen transition-all duration-500 ${
      darkMode 
        ? 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 text-white' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-50 text-gray-900'
    }`}>
      {/* Mobile-First Header */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        darkMode 
          ? 'bg-black/40 border-white/10 backdrop-blur-2xl' 
          : 'bg-white/40 border-gray-200/50 backdrop-blur-2xl'
      } border-b`}>
        <div className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            {/* Mobile Logo */}
            <div className="flex items-center gap-2 md:gap-4">
              <div className="relative">
                <div className="w-8 h-8 md:w-12 md:h-12 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-sm md:text-xl">🧠</span>
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl md:rounded-2xl opacity-20 blur-sm"></div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg md:text-xl font-semibold tracking-tight">Atlas</h1>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  AI Intelligence Platform
                </p>
              </div>
            </div>
            
            {/* Mobile Mode Toggle */}
            <div className="flex items-center justify-center">
              <div className={`flex p-1 rounded-xl md:rounded-2xl transition-all duration-300 ${
                darkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'
              }`}>
                {[
                  { mode: 'text', icon: '💬', label: isMobile ? '' : 'Chat', gradient: 'from-blue-500 to-indigo-600' },
                  { mode: 'voice', icon: '🎤', label: isMobile ? '' : 'Voice', gradient: 'from-purple-500 to-pink-600' },
                  { mode: 'image', icon: '🖼️', label: isMobile ? '' : 'Vision', gradient: 'from-emerald-500 to-teal-600' }
                ].map(({ mode, icon, label, gradient }) => (
                  <button
                    key={mode}
                    onClick={() => setCurrentMode(mode)}
                    className={`px-2 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-all duration-300 relative overflow-hidden ${
                      currentMode === mode
                        ? `bg-gradient-to-r ${gradient} text-white shadow-lg transform scale-105`
                        : darkMode 
                        ? 'text-gray-300 hover:text-white hover:bg-white/5' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                    }`}
                  >
                    <span className="relative z-10 flex items-center gap-1 md:gap-2">
                      <span className="text-sm md:text-lg">{icon}</span>
                      {label && <span className="hidden sm:inline">{label}</span>}
                    </span>
                    {currentMode === mode && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Mobile Controls */}
            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 md:p-3 rounded-lg md:rounded-xl transition-all duration-200 hover:scale-105 ${
                  darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                } ${showSettings ? 'bg-blue-500/20 text-blue-400' : ''}`}
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 md:p-3 rounded-lg md:rounded-xl transition-all duration-200 hover:scale-105 ${
                  darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                }`}
              >
                {darkMode ? (
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={`p-2 md:p-3 rounded-lg md:rounded-xl transition-all duration-200 hover:scale-105 ${
                  darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                }`}
              >
                <div className="w-5 h-5 md:w-6 md:h-6 relative">
                  <div className="absolute top-0 left-0 w-5 h-5 md:w-6 md:h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs md:text-sm font-bold">
                    {user?.name[0].toUpperCase()}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile-Responsive Settings Panel */}
      {showSettings && (
        <div className={`border-b transition-all duration-300 ${
          darkMode ? 'bg-black/20 border-white/10 backdrop-blur-xl' : 'bg-white/50 border-gray-200 backdrop-blur-xl'
        }`}>
          <div className="px-4 md:px-6 py-4 md:py-6">
            {/* Mobile: Stack vertically, Desktop: Side by side */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-8">
              {/* Personality Selection */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="text-sm font-medium whitespace-nowrap">AI Personality:</span>
                <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2 sm:pb-0">
                  {[
                    { id: 'supportive', icon: '💙', label: 'Supportive' },
                    { id: 'professional', icon: '💼', label: 'Professional' },
                    { id: 'creative', icon: '🎨', label: 'Creative' },
                    { id: 'casual', icon: '😎', label: 'Casual' }
                  ].map(({ id, icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setPersonality(id)}
                      className={`px-3 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                        personality === id
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                          : darkMode
                          ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span className="mr-1 md:mr-2">{icon}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Emotion Selection */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="text-sm font-medium whitespace-nowrap">How you're feeling:</span>
                <div className="flex gap-1 sm:gap-2">
                  {emotions.map(({ id, emoji, label, color }) => (
                    <button
                      key={id}
                      onClick={() => setCurrentEmotion(id)}
                      className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl transition-all duration-200 hover:scale-110 ${
                        currentEmotion === id
                          ? `bg-gradient-to-r ${color} text-white shadow-lg transform scale-110`
                          : darkMode
                          ? 'bg-white/5 hover:bg-white/10'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      title={label}
                    >
                      <span className="text-base md:text-lg">{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Status - Mobile: Full width, Desktop: Right aligned */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 lg:justify-end">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Claude Sonnet 4</span>
                </div>
                <div className="text-xs text-gray-500">
                  96% confidence • 347ms avg
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-80px)]">
        {/* Mobile-Responsive Sidebar */}
        {showSidebar && (
          <>
            {/* Mobile backdrop */}
            {isMobile && (
              <div 
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                onClick={() => setShowSidebar(false)}
              />
            )}
            
            <div className={`${isMobile ? 'fixed top-0 right-0 h-full w-80 z-50' : 'w-80 border-r'} transition-all duration-300 ${
              darkMode ? 'bg-black/90 md:bg-black/20 border-white/10 backdrop-blur-xl' : 'bg-white/95 md:bg-white/50 border-gray-200 backdrop-blur-xl'
            }`}>
              {/* Mobile close button */}
              {isMobile && (
                <div className="flex justify-end p-4">
                  <button
                    onClick={() => setShowSidebar(false)}
                    className={`p-2 rounded-lg ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              
              <div className="p-4 md:p-6 space-y-6">
                {/* Profile */}
                <div className={`p-4 rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-gray-100/50'}`}>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg">
                      {user?.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-base md:text-lg">{user?.name}</div>
                      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} truncate max-w-32`}>
                        {user?.email}
                      </div>
                      <div className="mt-1">
                        <span className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-blue-500 text-white text-xs rounded-full">
                          Premium User
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Voice Settings */}
                <div className={`p-4 rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-gray-100/50'}`}>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Voice Settings
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={autoSpeak}
                          onChange={(e) => setAutoSpeak(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition-all duration-200 ${
                          autoSpeak ? 'bg-gradient-to-r from-blue-500 to-purple-600' : darkMode ? 'bg-gray-600' : 'bg-gray-300'
                        }`}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-200 transform ${
                            autoSpeak ? 'translate-x-5' : 'translate-x-0.5'
                          } mt-0.5`}></div>
                        </div>
                      </div>
                      <span className="text-sm font-medium">Auto-speak responses</span>
                    </label>
                    
                    <button
                      onClick={() => {
                        if ('speechSynthesis' in window) {
                          const testMessage = "Hello! I'm Atlas, your premium AI companion.";
                          const utterance = new SpeechSynthesisUtterance(testMessage);
                          setIsSpeaking(true);
                          utterance.onend = () => setIsSpeaking(false);
                          speechSynthesis.speak(utterance);
                        }
                      }}
                      disabled={isSpeaking}
                      className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isSpeaking
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                      }`}
                    >
                      {isSpeaking ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Speaking...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 9h3l3-3v12l-3-3H9V9z" />
                          </svg>
                          Test Voice
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className={`p-4 rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-gray-100/50'}`}>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Quick Actions
                  </h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setMessages([])}
                      className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl text-sm font-medium hover:from-red-600 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear Conversation
                      </span>
                    </button>
                    
                    <button
                      onClick={() => setIsLoggedIn(false)}
                      className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                        darkMode 
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Main Content Area - Takes remaining space */}
        <div className={`flex-1 flex flex-col ${showSidebar && !isMobile ? 'md:ml-0' : ''} min-h-0`}>
          {/* Chat Messages - Scrollable area */}
          <div className="flex-1 overflow-y-auto pb-4">
            <div className="px-4 md:px-6 py-4 md:py-8 max-w-4xl mx-auto w-full">
              {messages.length === 0 ? (
                <div className="text-center py-12 md:py-20">
                  {/* Premium welcome screen - Mobile responsive */}
                  <div className="relative mb-6 md:mb-8">
                    <div className="w-24 h-24 md:w-32 md:h-32 mx-auto bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-2xl">
                      <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-r from-white/10 to-white/5 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <span className="text-3xl md:text-5xl">🧠</span>
                      </div>
                    </div>
                    <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full opacity-20 blur-xl animate-pulse"></div>
                  </div>
                  
                  <h2 className="text-2xl md:text-4xl font-light mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Welcome to Atlas Premium
                  </h2>
                  <p className={`text-base md:text-xl mb-6 md:mb-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'} max-w-2xl mx-auto leading-relaxed px-4`}>
                    Your advanced AI companion with emotional intelligence, personality adaptation, and premium features.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4 mb-6 md:mb-8 px-4">
                    <div className="px-4 py-3 md:px-6 md:py-3 bg-gradient-to-r from-blue-500/20 to-indigo-600/20 border border-blue-500/30 rounded-2xl backdrop-blur-sm">
                      <div className="text-sm font-semibold text-blue-400 mb-1">Smart Routing</div>
                      <div className="text-xs text-gray-500">Optimal AI selection</div>
                    </div>
                    <div className="px-4 py-3 md:px-6 md:py-3 bg-gradient-to-r from-purple-500/20 to-pink-600/20 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                      <div className="text-sm font-semibold text-purple-400 mb-1">Emotional AI</div>
                      <div className="text-xs text-gray-500">Adapts to your mood</div>
                    </div>
                    <div className="px-4 py-3 md:px-6 md:py-3 bg-gradient-to-r from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 rounded-2xl backdrop-blur-sm">
                      <div className="text-sm font-semibold text-emerald-400 mb-1">Voice Synthesis</div>
                      <div className="text-xs text-gray-500">Natural speech</div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-500 px-4">
                    Select your personality and emotion above, then start chatting
                  </div>
                </div>
              ) : (
                <div className="space-y-4 md:space-y-8">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-2xl px-4 py-3 md:px-6 md:py-4 rounded-2xl md:rounded-3xl transition-all duration-300 ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                            : darkMode
                            ? 'bg-white/10 text-white border border-white/20 backdrop-blur-sm shadow-lg'
                            : 'bg-white border border-gray-200 shadow-lg'
                        } group-hover:shadow-xl group-hover:scale-[1.02]`}
                      >
                        <div className="text-sm md:text-[15px] leading-relaxed font-medium">
                          {message.content}
                        </div>
                        
                        {message.metadata && message.role === 'assistant' && (
                          <div className={`text-xs mt-3 md:mt-4 pt-3 md:pt-4 border-t opacity-70 space-y-2 ${
                            darkMode ? 'border-white/20' : 'border-gray-200'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                <span className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                  {message.metadata.provider}
                                </span>
                                <span className="flex items-center gap-1">
                                  ⚡ {message.metadata.responseTime}ms
                                </span>
                                <span className="flex items-center gap-1">
                                  🎯 {(message.metadata.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              {message.metadata.cached && (
                                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs">
                                  💾 Cached
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isProcessing && (
                    <div className="flex justify-start group">
                      <div className={`max-w-[85%] md:max-w-2xl px-4 py-3 md:px-6 md:py-4 rounded-2xl md:rounded-3xl ${
                        darkMode ? 'bg-white/10 border border-white/20 backdrop-blur-sm' : 'bg-white border border-gray-200'
                      } shadow-lg`}>
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 md:w-3 md:h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 md:w-3 md:h-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 md:w-3 md:h-3 bg-gradient-to-r from-pink-500 to-red-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <span className="text-sm font-medium">Atlas is crafting a response...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Input Area at Bottom - Like WhatsApp/iMessage */}
      <div className={`fixed bottom-0 left-0 right-0 border-t transition-all duration-300 z-30 ${
        darkMode ? 'bg-black/90 border-white/10 backdrop-blur-xl' : 'bg-white/95 border-gray-200 backdrop-blur-xl'
      } ${showSidebar && !isMobile ? 'md:left-80' : ''}`}>
        <div className="px-4 md:px-6 py-4 md:py-6 max-w-4xl mx-auto w-full">
          <div className="flex items-end gap-2 md:gap-4">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message Atlas..."
                className={`w-full px-4 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm md:text-base ${
                  darkMode 
                    ? 'bg-white/10 border border-white/20 text-white placeholder-gray-400 backdrop-blur-sm' 
                    : 'bg-white border border-gray-200 placeholder-gray-500 shadow-sm'
                }`}
                rows={1}
                disabled={isProcessing}
                style={{
                  minHeight: '48px',
                  maxHeight: '120px'
                }}
              />
              
              {/* Mobile-responsive status indicators */}
              <div className="flex items-center justify-between mt-2 md:mt-3">
                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs">
                  <span className={`flex items-center gap-1 md:gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
                    <span className="hidden sm:inline">{personality.charAt(0).toUpperCase() + personality.slice(1)}</span>
                    <span className="sm:hidden">{personality.charAt(0).toUpperCase()}</span>
                  </span>
                  <span className={`flex items-center gap-1 md:gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {emotions.find(e => e.id === currentEmotion)?.emoji} 
                    <span className="hidden sm:inline">{currentEmotion}</span>
                  </span>
                  <span className={`flex items-center gap-1 md:gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="hidden sm:inline">Claude Sonnet 4</span>
                    <span className="sm:hidden">Claude</span>
                  </span>
                  {autoSpeak && (
                    <span className="flex items-center gap-1 md:gap-2 text-emerald-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 9h3l3-3v12l-3-3H9V9z" />
                      </svg>
                      <span className="hidden sm:inline">Auto-speak</span>
                    </span>
                  )}
                  {isSpeaking && (
                    <span className="flex items-center gap-1 md:gap-2 text-blue-400 animate-pulse">
                      <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="hidden sm:inline">Speaking...</span>
                    </span>
                  )}
                </div>
                
                <div className={`text-xs ${
                  inputMessage.length > 800 ? 'text-red-400' : darkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {inputMessage.length}/1000
                </div>
              </div>
            </div>

            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isProcessing}
              className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl md:rounded-2xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg hover:shadow-xl"
            >
              {isProcessing ? (
                <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Add bottom padding to prevent content from being hidden behind fixed input */}
      <div className="pb-32 md:pb-40"></div>
    </div>
  );
};

export default AtlasApp;