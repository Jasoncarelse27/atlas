import { CHAT_CONFIG } from '@/config/chat';
import { loadRecentMessages, saveMessage, type Message as StoredMessage } from '@/features/chat/storage';
import { streamAtlasReply } from '@/features/chat/stream';
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart3,
    Book,
    Brain,
    Dumbbell,
    Heart,
    History,
    Image,
    Lock,
    MessageSquare,
    Mic,
    Paperclip,
    Plus,
    Send,
    Target,
    Users,
    X,
    Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

// Local fallback type for UI rendering
type Message = {
  id: number;
  type: "user" | "atlas";
  content: string;
  timestamp: Date;
  suggestions?: string[];
};

const palette = {
  sage: "var(--atlas-sage)",
  sand: "var(--atlas-sand)",
  pearl: "var(--atlas-pearl)",
};

const AtlasDrawerInterface: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState("chat");
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isToggleDrawerOpen, setIsToggleDrawerOpen] = useState(false);

  // Drawer control functions
  const toggleDrawer = () => {
    setIsToggleDrawerOpen(prev => {
      const newState = !prev;
      console.log("Drawer state toggled →", newState ? "OPEN" : "CLOSED");
      return newState;
    });
  };
  const closeDrawer = () => {
    console.log("Drawer state toggled → CLOSED");
    setIsToggleDrawerOpen(false);
  };

  const [messages, setMessages] = useState<Message[]>([]);

  // Load messages on mount
  useEffect(() => {
    (async () => {
      const fromDb = await loadRecentMessages(100);
      if (fromDb.length) {
        // Convert stored messages to UI format
        const uiMessages: Message[] = fromDb.map((msg, index) => ({
          id: index + 1,
          type: msg.role as "user" | "atlas",
          content: msg.content,
          timestamp: new Date(msg.created_at || Date.now()),
          suggestions: msg.role === 'atlas' ? ["Tell me more", "What would help right now?", "Show my progress"] : undefined,
        }));
        setMessages(uiMessages);
      } else {
        // Keep sample messages for first-run/dev
        setMessages([
          {
            id: 1,
            type: "atlas",
            content: "Good morning! I see you completed your morning exercise - that's a 13-day streak now! How are you feeling today, and would you like to do your habit check-in or start with something else?",
            timestamp: new Date(),
            suggestions: ["Daily habit check-in", "Morning ritual", "How's my mood today?"],
          },
          {
            id: 2,
            type: "user",
            content: "I've been feeling a bit overwhelmed with work lately. There's just so much on my plate.",
            timestamp: new Date(Date.now() - 120000),
          },
          {
            id: 3,
            type: "atlas",
            content: "I understand what you're going through. Based on your recent patterns, I notice your stress levels tend to be higher on days when you skip your morning routine. Would you like to explore some strategies to help you feel more centered, or shall we work on a quick 3-minute reset ritual?",
            timestamp: new Date(Date.now() - 60000),
            suggestions: ["3-minute reset ritual", "Stress management tips", "Check my patterns"],
          },
        ]);
      }
    })();
  }, []);

  // Smooth autoscroll to latest message
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Mobile keyboard handling
  useEffect(() => {
    const handleResize = () => {
      const initialViewportHeight = window.visualViewport?.height || window.innerHeight;
      const currentViewportHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = initialViewportHeight - currentViewportHeight;
      
      // If viewport height decreased significantly, keyboard is likely open
      setIsKeyboardOpen(heightDifference > 150);
    };

    // Listen for viewport changes (mobile keyboard)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  // Auto-focus input on mobile when keyboard opens and close toggle drawer
  useEffect(() => {
    if (isKeyboardOpen && inputRef.current) {
      inputRef.current.focus();
      closeDrawer(); // Close toggle drawer when keyboard opens
    }
  }, [isKeyboardOpen]);

  const tools = useMemo(
    () => [
      { id: "ritual-builder", title: "Ritual Builder", icon: Target, category: "Wellness", active: true },
      { id: "habit-tracker", title: "Habit Tracker", icon: BarChart3, category: "Wellness", active: true },
      { id: "personal-reflections", title: "Personal Reflections", icon: Lock, category: "Wellness", active: false },

      { id: "oral-prep", title: "Oral Prep Assistant", icon: Users, category: "Productivity", active: false },
      { id: "eq-voice", title: "EQ Voice Call", icon: Mic, category: "Productivity", active: false },

      { id: "daily-challenges", title: "Daily EQ Challenges", icon: Zap, category: "Growth", active: true },

      { id: "conversation-history", title: "Conversation History", icon: History, category: "History", active: true },
    ],
    []
  );


  const formatTime = (ts: Date) =>
    ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || isTyping) return;

    const userMsg: Message = {
      id: messages.length + 1,
      type: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    
    // Dismiss keyboard on mobile after sending
    if (inputRef.current) {
      inputRef.current.blur();
    }
    
    // Save user message
    const storedUserMsg: StoredMessage = { role: 'user', content: text };
    saveMessage(storedUserMsg).catch(() => {});

    // Start atlas reply (streaming)
    setIsTyping(true);
    const partial: Message = { 
      id: messages.length + 2, 
      type: "atlas", 
      content: '', 
      timestamp: new Date(),
      suggestions: ["Tell me more", "What would help right now?", "Show my progress"]
    };
    setMessages(prev => [...prev, partial]);

    try {
      // Fallback to mock when no API configured
      if (CHAT_CONFIG.useMockWhenMissingCreds && !CHAT_CONFIG.apiBase) {
        const mock = "Thanks for sharing. Let's take one small, kind step together.";
        // simulate small chunks
        for (const ch of mock.split(' ')) {
          await new Promise(r => setTimeout(r, 80));
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { ...copy[copy.length - 1], content: (copy[copy.length - 1].content ?? '') + (copy[copy.length - 1].content ? ' ' : '') + ch };
            return copy;
          });
        }
        saveMessage({ role: 'atlas', content: mock }).catch(() => {});
      } else {
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        // Convert current messages to stored format for API
        const history: StoredMessage[] = messages.map(msg => ({
          role: msg.type as 'user' | 'atlas',
          content: msg.content
        }));
        history.push(storedUserMsg);

        await streamAtlasReply(
          history,
          (chunk) => {
            setMessages(prev => {
              const copy = [...prev];
              copy[copy.length - 1] = { ...copy[copy.length - 1], content: (copy[copy.length - 1].content ?? '') + chunk };
              return copy;
            });
          },
          abortRef.current.signal
        );

        // Save final atlas message
        setMessages(prev => {
          const final = prev[prev.length - 1];
          if (final && final.type === 'atlas') {
            saveMessage({ role: 'atlas', content: final.content }).catch(() => {});
          }
          return prev;
        });
      }
    } catch {
      // Append a gentle error note to the partial message
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: (copy[copy.length - 1].content ?? '') + '\n\n(temporary connection issue)' };
        return copy;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    const newMsg: Message = {
      id: messages.length + 1,
      type: "user",
      content: suggestion,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMsg]);
    
    // Save suggestion as user message
    const storedMsg: StoredMessage = { role: 'user', content: suggestion };
    saveMessage(storedMsg).catch(() => {});
  };

  // Handle clicking outside input to dismiss keyboard and toggle drawer
  const handleContainerClick = (e: React.MouseEvent) => {
    if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
      inputRef.current.blur();
    }
    // Close toggle drawer when clicking outside
    closeDrawer();
  };

  return (
    <div 
      className="flex h-screen relative" 
      style={{ 
        backgroundColor: palette.pearl,
        // Ensure proper mobile viewport handling
        minHeight: '100dvh', // Dynamic viewport height for mobile
      }}
      onClick={handleContainerClick}
    >
      {/* Overlay */}
      {isDrawerOpen && (
        <button
          aria-label="Close drawer overlay"
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 border-r transform transition-transform duration-300 ease-in-out z-50 shadow-2xl ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: palette.sand, borderColor: palette.sage }}
      >
        {/* Header (fixed) */}
        <div className="p-4 border-b" style={{ borderColor: palette.sage }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: palette.sage }}
              >
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-slate-700">Atlas Tools</h1>
                <p className="text-xs text-slate-600">Your EQ Toolkit</p>
              </div>
            </div>
            <button
              aria-label="Close drawer"
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ backgroundColor: "transparent" }}
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Chat shortcut (fixed) */}
        <div className="p-2">
          <button
            onClick={() => {
              setActiveTool("chat");
              setIsDrawerOpen(false);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
            style={activeTool === "chat" ? { backgroundColor: palette.pearl } : undefined}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: activeTool === "chat" ? palette.sage : palette.pearl }}
            >
              <MessageSquare
                className={`w-4 h-4 ${activeTool === "chat" ? "text-white" : "text-slate-600"}`}
              />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium text-sm text-slate-700">Chat with Atlas</span>
            </div>
          </button>
        </div>

        {/* Scrollable tools */}
        <div className="flex-1 min-h-0">
          <div className="h-full overflow-y-auto p-2">
            {["Wellness", "Productivity", "Growth"].map((category) => (
              <section key={category} className="mb-6">
                <div className="px-3 py-2 mb-2">
                  <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                    {category}
                  </h3>
                </div>

                <ul className="space-y-1">
                  {tools
                    .filter((t) => t.category === category)
                    .map((tool) => {
                      const Icon = tool.icon;
                      const selected = activeTool === tool.id;
                      return (
                        <li key={tool.id}>
                          <button
                            onClick={() => {
                              setActiveTool(tool.id);
                              setIsDrawerOpen(false);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:shadow-sm"
                            style={selected ? { backgroundColor: palette.pearl } : undefined}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{
                                backgroundColor: selected ? palette.sage : palette.sand,
                              }}
                            >
                              <Icon
                                className="w-4 h-4"
                                style={{ color: selected ? "white" : palette.sage }}
                              />
                            </div>
                            <div className="flex-1 text-left">
                              <span className="font-medium text-sm text-slate-700">
                                {tool.title}
                              </span>
                            </div>
                            {tool.active && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </section>
            ))}

            {/* History (kept at bottom of scroll) */}
            <section className="mb-6">
              <div className="px-3 py-2 mb-2">
                <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wide">History</h3>
              </div>

              <ul className="space-y-1">
                {tools
                  .filter((t) => t.category === "History")
                  .map((tool) => {
                    const Icon = tool.icon;
                    const selected = activeTool === tool.id;
                    return (
                      <li key={tool.id}>
                        <button
                          onClick={() => {
                            setActiveTool(tool.id);
                            setIsDrawerOpen(false);
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:shadow-sm"
                          style={selected ? { backgroundColor: palette.pearl } : undefined}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: selected ? palette.sage : palette.sand,
                            }}
                          >
                            <Icon
                              className="w-4 h-4"
                              style={{ color: selected ? "white" : palette.sage }}
                            />
                          </div>
                          <div className="flex-1 text-left">
                            <span className="font-medium text-sm text-slate-700">
                              {tool.title}
                            </span>
                          </div>
                          {tool.active && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </section>
          </div>
        </div>

        {/* Quick stats (fixed) */}
        <footer className="p-4 border-t" style={{ borderColor: palette.sage }}>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Today's Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-3 h-3" style={{ color: palette.sage }} />
              <span className="text-slate-700">Exercise: 13 day streak</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-3 h-3" style={{ color: palette.sage }} />
              <span className="text-slate-700">Mood: 7/10</span>
            </div>
            <div className="flex items-center gap-2">
              <Book className="w-3 h-3" style={{ color: palette.sage }} />
              <span className="text-slate-700">EQ Challenge: Complete</span>
            </div>
          </div>
        </footer>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header
          className="border-b p-4"
          style={{ backgroundColor: palette.sand, borderColor: palette.sage }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center hover:opacity-90 transition-all"
                style={{ backgroundColor: palette.sage }}
                aria-label="Open tools drawer"
              >
                <Brain className="w-6 h-6 text-white" />
              </button>
              <h1 className="text-xl font-semibold text-slate-700">Atlas</h1>
            </div>

            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-slate-700">
                <Dumbbell className="w-3 h-3" style={{ color: palette.sage }} />
                <span>13 day streak</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <Heart className="w-3 h-3" style={{ color: palette.sage }} />
                <span>Mood: 7/10</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <Book className="w-3 h-3" style={{ color: palette.sage }} />
                <span>EQ Challenge: Complete</span>
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <section className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.type === "user" ? "justify-end" : "justify-start"}`}>
                {m.type === "atlas" ? (
                  <div className="flex items-start gap-4 max-w-3xl">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: palette.sage }}
                    >
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="leading-relaxed text-slate-800">{m.content}</p>
                      <p className="text-xs text-slate-500">{formatTime(m.timestamp)}</p>

                      {m.suggestions && (
                        <div className="flex flex-wrap gap-2">
                          {m.suggestions.map((s, i) => (
                            <button
                              key={`${m.id}-sugg-${i}`}
                              onClick={() => handleSuggestionClick(s)}
                              className="px-4 py-2 rounded-lg text-sm transition-all hover:shadow-sm border"
                              style={{
                                backgroundColor: palette.pearl,
                                color: "#4a5568",
                                borderColor: palette.sage,
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl">
                    <div
                      className="rounded-2xl p-6 shadow-sm text-white"
                      style={{ backgroundColor: palette.sage }}
                    >
                      <p className="leading-relaxed">{m.content}</p>
                      <p className="text-xs mt-2 opacity-80">{formatTime(m.timestamp)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start gap-4 max-w-3xl">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: palette.sage }}
                  >
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: palette.sage }} />
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: palette.sage, animationDelay: "150ms" }} />
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: palette.sage, animationDelay: "300ms" }} />
                      </div>
                      <span className="text-sm text-slate-600">Atlas is thinking…</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>
        </section>

        {/* Composer */}
        <footer className="border-t p-6" style={{ backgroundColor: palette.sand, borderColor: palette.sage }}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              {/* + Toggle Drawer Button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  toggleDrawer();
                  // Close keyboard when opening drawer
                  if (inputRef.current) {
                    inputRef.current.blur();
                  }
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: palette.sage,
                  "--tw-ring-color": palette.sage,
                }}
                aria-label="Toggle options"
              >
                <Plus className="w-5 h-5 text-white" />
              </motion.button>

              {/* Input Field */}
              <div className="flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  onFocus={() => {
                    // Close drawer when keyboard opens
                    closeDrawer();
                    // Ensure input is visible when focused on mobile
                    setTimeout(() => {
                      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                  }}
                  placeholder="Message Atlas..."
                  className="w-full px-4 py-3 rounded-2xl border text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: palette.pearl,
                    borderColor: palette.sage,
                    // tailwind ring color via inline css var
                    // @ts-expect-error – custom CSS var for ring
                    "--tw-ring-color": palette.sage,
                  }}
                  // Mobile-specific attributes
                  autoComplete="off"
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  spellCheck="true"
                />
              </div>

              {/* > Send Button */}
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isTyping}
                className="w-12 h-12 text-white rounded-full hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: palette.sage,
                  "--tw-ring-color": palette.sage,
                }}
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="mt-3 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-slate-600 whitespace-nowrap">Atlas suggests:</span>
              <div className="flex gap-2">
                {["How's my progress today?", "Start a ritual", "Prep for my meeting"].map((s, i) => (
                  <button
                    key={`quick-${i}`}
                    onClick={() => handleSuggestionClick(s)}
                    className="px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap hover:shadow-sm border"
                    style={{
                      backgroundColor: palette.pearl,
                      color: "#4a5568",
                      borderColor: palette.sage,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </footer>

        {/* Animated Toggle Drawer */}
        <AnimatePresence>
          {isToggleDrawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black z-40"
                onClick={closeDrawer}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed bottom-0 left-0 right-0 h-[45vh] max-h-[400px] bg-white rounded-t-2xl shadow-lg z-50 p-6"
              >
                <div className="flex justify-around mt-6">
                  <button
                    onClick={() => console.log("Voice button pressed")}
                    className="p-3 bg-[#B2BDA3] rounded-full"
                  >
                    <Mic className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={() => console.log("Image button pressed")}
                    className="p-3 bg-[#F4E5D9] rounded-full"
                  >
                    <Image className="w-6 h-6 text-[#333]" />
                  </button>
                  <button
                    onClick={() => console.log("Habit Tracker pressed")}
                    className="p-3 bg-[#EBDFCE] rounded-full"
                  >
                    <BarChart3 className="w-6 h-6 text-[#333]" />
                  </button>
                  <button
                    onClick={() => console.log("Reflections pressed")}
                    className="p-3 bg-[#B2BDA3] rounded-full"
                  >
                    <Book className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={() => console.log("File attach pressed")}
                    className="p-3 bg-[#F4E5D9] rounded-full"
                  >
                    <Paperclip className="w-6 h-6 text-[#333]" />
                  </button>
                </div>
                <button
                  onClick={closeDrawer}
                  className="text-sm text-gray-700 underline mt-4"
                >
                  Collapse
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AtlasDrawerInterface;
