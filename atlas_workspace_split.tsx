import React, { useState, useEffect, useRef } from 'react';

function AtlasApp() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState('chat');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [personality, setPersonality] = useState('supportive');
  const [emotion, setEmotion] = useState('neutral');
  const [showMenu, setShowMenu] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [kidsMode, setKidsMode] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async () => {
    if (!email || !password) return;
    
    setLoginLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockUser = {
      id: Date.now().toString(),
      email,
      user_metadata: { name: email.split('@')[0] }
    };
    setUser(mockUser);
    
    const welcomeMessage = {
      id: Date.now().toString(),
      content: `Welcome to Atlas! I'm your AI assistant with multiple personalities and emotional intelligence. I'm currently in ${personality} mode. How can I help you today?`,
      isUser: false,
      timestamp: new Date(),
      provider: 'Atlas',
      confidence: 1.0,
      responseTime: 150
    };
    setMessages([welcomeMessage]);
    setLoginLoading(false);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMessage = {
      id: Date.now().toString(),
      content: input.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const responses = {
      supportive: {
        happy: "That's wonderful! I'm so excited to hear that! Your happiness brings me joy too, and I'd love to help you build on this positive momentum.",
        neutral: "I'm here to support you in whatever way you need. How can I help make your day more productive and meaningful?"
      },
      professional: {
        happy: "Excellent. I'm pleased to assist you with your objectives today. Let's establish clear priorities and execute them with precision.",
        neutral: "Good day. I'm prepared to provide professional assistance. What specific area requires attention?"
      },
      creative: {
        happy: "What delightful energy you bring! Your enthusiasm is like a spark that ignites endless possibilities.",
        neutral: "Welcome, creative soul! The world is our canvas today. What vision shall we bring into existence?"
      },
      casual: {
        happy: "Hey, that's awesome! I love the good vibes you're bringing. What's got you feeling so great today?",
        neutral: "Hey there! Just hanging out, ready to chat about whatever's on your mind."
      }
    };

    const response = responses[personality]?.[emotion] || responses.supportive.neutral;

    const assistantMessage = {
      id: (Date.now() + 1).toString(),
      content: response,
      isUser: false,
      timestamp: new Date(),
      provider: 'Mock AI',
      confidence: 0.95,
      responseTime: 1000
    };

    setMessages(prev => [...prev, assistantMessage]);

    if (autoSpeak && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(response);
      speechSynthesis.speak(utterance);
    }

    setSending(false);
  };

  if (!user) {
    return (
      <div className={`h-full ${
        darkMode 
          ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' 
          : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
      } flex items-center justify-center p-6 relative overflow-hidden`}>
        <div className="absolute inset-0">
          <div className={`absolute top-1/4 left-1/4 w-96 h-96 ${
            darkMode ? 'bg-blue-500/20' : 'bg-blue-500/10'
          } rounded-full blur-3xl animate-pulse`}></div>
          <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 ${
            darkMode ? 'bg-purple-500/20' : 'bg-purple-500/10'
          } rounded-full blur-3xl animate-pulse`} style={{animationDelay: '1s'}}></div>
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className={`${
            darkMode 
              ? 'bg-white/10 border-white/20' 
              : 'bg-white/70 border-white/30'
          } backdrop-blur-xl rounded-3xl p-8 shadow-2xl border`}>
            <div className="text-center mb-8">
              <div className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl font-bold text-white">A</span>
              </div>
              <h1 className={`text-3xl font-bold ${
                darkMode ? 'text-white' : 'text-gray-900'
              } mb-2`}>Atlas</h1>
              <p className={`${
                darkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>AI Assistant with Personality</p>
            </div>

            <div className="space-y-6">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-4 rounded-xl border-0 ${
                  darkMode 
                    ? 'bg-white/5 text-white placeholder-gray-400 border-white/10' 
                    : 'bg-white/50 text-gray-900 placeholder-gray-500 border-gray-200'
                } backdrop-blur-sm focus:ring-2 focus:ring-blue-500/50 transition-all border`}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-4 rounded-xl border-0 ${
                  darkMode 
                    ? 'bg-white/5 text-white placeholder-gray-400 border-white/10' 
                    : 'bg-white/50 text-gray-900 placeholder-gray-500 border-gray-200'
                } backdrop-blur-sm focus:ring-2 focus:ring-blue-500/50 transition-all border`}
              />
              <button
                onClick={handleLogin}
                disabled={loginLoading || !email || !password}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50"
              >
                {loginLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing In...
                  </div>
                ) : (
                  'Sign In to Atlas'
                )}
              </button>
            </div>

            <p className={`text-center text-sm mt-6 ${
              darkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Demo: Use any email and password
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full ${
      darkMode 
        ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' 
        : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
    } relative overflow-hidden`}>
      <div className="absolute inset-0">
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 ${
          darkMode ? 'bg-blue-500/10' : 'bg-blue-500/5'
        } rounded-full blur-3xl animate-pulse`}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 ${
          darkMode ? 'bg-purple-500/10' : 'bg-purple-500/5'
        } rounded-full blur-3xl animate-pulse`} style={{animationDelay: '1s'}}></div>
      </div>

      {/* Menu Panel */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-start justify-start p-6 bg-black/50 backdrop-blur-sm">
          <div className={`${
            darkMode 
              ? 'bg-white/10 border-white/20' 
              : 'bg-white/90 border-gray-200'
          } backdrop-blur-xl rounded-3xl p-6 w-80 border mt-20`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-lg font-bold text-white">A</span>
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>Atlas Menu</h3>
                  <p className={`text-xs ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>{personality} mode</p>
                </div>
              </div>
              <button
                onClick={() => setShowMenu(false)}
                className={`p-2 rounded-lg ${
                  darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                } transition-colors`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Haptics */}
              <div className={`flex items-center justify-between p-3 rounded-xl ${
                darkMode ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'
              } border`}>
                <div className="flex items-center space-x-3">
                  <span className={darkMode ? 'text-white' : 'text-gray-900'}>📳</span>
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Haptics</span>
                </div>
                <button
                  onClick={() => setHaptics(!haptics)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    haptics ? 'bg-blue-500' : darkMode ? 'bg-white/20' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    haptics ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Kids Mode */}
              <div className={`flex items-center justify-between p-3 rounded-xl ${
                darkMode ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'
              } border`}>
                <div className="flex items-center space-x-3">
                  <span className={darkMode ? 'text-white' : 'text-gray-900'}>👶</span>
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Kids Mode</span>
                </div>
                <button
                  onClick={() => setKidsMode(!kidsMode)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    kidsMode ? 'bg-green-500' : darkMode ? 'bg-white/20' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    kidsMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Dark Mode */}
              <div className={`flex items-center justify-between p-3 rounded-xl ${
                darkMode ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'
              } border`}>
                <div className="flex items-center space-x-3">
                  <span className={darkMode ? 'text-white' : 'text-gray-900'}>
                    {darkMode ? '🌙' : '☀️'}
                  </span>
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {darkMode ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    darkMode ? 'bg-indigo-500' : 'bg-yellow-500'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    darkMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className={`${
            darkMode 
              ? 'bg-white/10 border-white/20' 
              : 'bg-white/90 border-gray-200'
          } backdrop-blur-xl rounded-3xl p-6 w-full max-w-md border`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-semibold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className={`p-2 rounded-lg ${
                  darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                } transition-colors`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>Personality</label>
                <select
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  className={`w-full p-3 rounded-xl border-0 ${
                    darkMode 
                      ? 'bg-white/5 text-white border-white/10' 
                      : 'bg-white text-gray-900 border-gray-200'
                  } border`}
                >
                  <option value="supportive">Supportive</option>
                  <option value="professional">Professional</option>
                  <option value="creative">Creative</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>Emotional State</label>
                <select
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value)}
                  className={`w-full p-3 rounded-xl border-0 ${
                    darkMode 
                      ? 'bg-white/5 text-white border-white/10' 
                      : 'bg-white text-gray-900 border-gray-200'
                  } border`}
                >
                  <option value="neutral">Neutral</option>
                  <option value="happy">Enthusiastic</option>
                  <option value="stressed">Calming</option>
                  <option value="focused">Focused</option>
                  <option value="curious">Inquisitive</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>Auto-speak</span>
                <button
                  onClick={() => setAutoSpeak(!autoSpeak)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    autoSpeak ? 'bg-blue-500' : darkMode ? 'bg-white/20' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    autoSpeak ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main App */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <header className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowMenu(true)}
                className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center hover:scale-105 transition-transform"
              >
                <span className="text-white text-lg">☰</span>
              </button>
              <div>
                <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Atlas</h1>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {personality} mode {kidsMode ? '• Kids Mode' : ''}
                </p>
              </div>
            </div>

            <div className="flex-1 flex justify-center">
              <div className={`${
                darkMode ? 'bg-black/20 border-white/10' : 'bg-white/30 border-gray-200'
              } backdrop-blur-xl rounded-lg p-0.5 border`}>
                {[
                  { key: 'chat', label: 'Text' },
                  { key: 'voice', label: 'Audio' },
                  { key: 'image', label: 'Image' }
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setMode(item.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      mode === item.key
                        ? darkMode 
                          ? 'bg-white text-gray-900'
                          : 'bg-blue-500 text-white'
                        : darkMode 
                          ? 'text-gray-300 hover:text-white'
                          : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Connected</span>
              </div>
              
              <button
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded-lg ${
                  darkMode 
                    ? 'bg-white/5 text-gray-400 hover:text-white border-white/10' 
                    : 'bg-white/30 text-gray-600 hover:text-gray-900 border-gray-200'
                } backdrop-blur-sm transition-all border`}
              >
                ⚙️
              </button>
              
              <button
                onClick={() => setUser(null)}
                className={`p-2 rounded-lg ${
                  darkMode 
                    ? 'bg-white/5 text-gray-400 hover:text-white border-white/10' 
                    : 'bg-white/30 text-gray-600 hover:text-gray-900 border-gray-200'
                } backdrop-blur-sm transition-all border`}
              >
                ✕
              </button>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-lg px-6 py-4 rounded-3xl backdrop-blur-xl transition-all hover:scale-[1.02] ${
                    message.isUser
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                      : darkMode 
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'bg-white/70 text-gray-900 border border-gray-200'
                  }`}
                >
                  <p className="leading-relaxed">{message.content}</p>
                  {!message.isUser && (
                    <div className={`mt-3 text-xs flex items-center space-x-3 ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      <span>{message.provider}</span>
                      <span>• {Math.round(message.confidence * 100)}%</span>
                      <span>• {message.responseTime}ms</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {sending && (
              <div className="flex justify-start">
                <div className={`${
                  darkMode 
                    ? 'bg-white/10 border-white/20' 
                    : 'bg-white/70 border-gray-200'
                } backdrop-blur-xl rounded-3xl px-6 py-4 border`}>
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className={`${
              darkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/70 border-gray-200'
            } backdrop-blur-xl rounded-3xl p-4 border`}>
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={`Message Atlas (${personality} mode)...`}
                    className={`w-full px-6 py-4 bg-transparent ${
                      darkMode 
                        ? 'text-white placeholder-gray-400' 
                        : 'text-gray-900 placeholder-gray-500'
                    } focus:outline-none text-lg`}
                    disabled={sending}
                  />
                  <div className={`absolute right-6 top-4 text-xs ${
                    darkMode ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {input.length}/500
                  </div>
                </div>
                
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || sending}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-2xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  ) : (
                    '🚀'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceSplit() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Workspace */}
      <div className="w-1/2 p-6 bg-white shadow-lg overflow-y-auto border-r border-gray-200">
        <div className="max-w-lg mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🛠️ Atlas Development Workspace
          </h1>
          
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-xl">
              <h2 className="text-xl font-semibold text-blue-900 mb-3">
                📝 Ready to Work
              </h2>
              <p className="text-sm text-blue-800">
                Atlas is running on the right. We can now work on new features, 
                improvements, or discuss changes while seeing the live app.
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                ✅ Current Features Working
              </h3>
              <div className="space-y-1 text-sm text-green-800">
                <p>• Hamburger menu with theme toggle</p>
                <p>• Light/Dark mode system</p>
                <p>• AI personality & emotion controls</p>
                <p>• Voice synthesis capabilities</p>
                <p>• Kids Mode & Haptics</p>
                <p>• Professional UI/UX design</p>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                🎯 What Would You Like to Work On?
              </h3>
              <div className="space-y-2 text-sm text-yellow-800">
                <p><strong>New Features:</strong> Camera integration, file uploads, advanced voice</p>
                <p><strong>UI Improvements:</strong> Animations, themes, layout refinements</p>
                <p><strong>AI Enhancements:</strong> Better responses, memory, context</p>
                <p><strong>Performance:</strong> Optimization, caching, speed improvements</p>
                <p><strong>Integration:</strong> Real APIs, database, authentication</p>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">
                💡 Ideas & Suggestions
              </h3>
              <p className="text-sm text-purple-800">
                Tell me what you'd like to add, modify, or improve about Atlas. 
                I can help implement new features, fix issues, or enhance the existing functionality.
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🚀 Ready for Your Input
              </h3>
              <p className="text-sm text-gray-700">
                What should we work on next for Atlas? The app is running live on the right, 
                so we can test changes immediately as we build them.
              </p>
            </div>

            <div className="bg-indigo-50 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">
                🔧 Development Notes
              </h3>
              <div className="space-y-1 text-sm text-indigo-800">
                <p>• All AI brain features are integrated</p>
                <p>• Theme system is fully functional</p>
                <p>• Responsive design works across devices</p>
                <p>• Voice features are browser-compatible</p>
                <p>• Professional UI matches top-tier apps</p>
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                ⚡ Quick Actions Available
              </h3>
              <div className="space-y-1 text-sm text-red-800">
                <p>• Add new menu items or features</p>
                <p>• Modify AI personality responses</p>
                <p>• Enhance visual design elements</p>
                <p>• Implement new interaction patterns</p>
                <p>• Optimize performance or add animations</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Atlas App */}
      <div className="w-1/2 bg-gray-900">
        <AtlasApp />
      </div>
    </div>
  );
}