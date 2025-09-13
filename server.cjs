// server.js - Atlas AI Backend Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for backend
);

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Enhanced rate limiting for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.AI_RATE_LIMIT_MAX) || 30,
  message: 'AI request rate limit exceeded. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Subscription tier configuration
const TIER_LIMITS = {
  free: {
    dailyPrompts: 5,
    monthlyJournalEntries: 5,
    dailyMoodTracking: true,
    dailyInsights: 3,
    features: ['basic_mood_tracking', 'limited_journal', 'light_streaks']
  },
  pro: {
    dailyPrompts: -1, // unlimited
    monthlyJournalEntries: -1, // unlimited
    dailyMoodTracking: true,
    dailyInsights: -1,
    features: ['unlimited_journal', 'advanced_streaks', 'personalized_summaries', 
              'custom_prompts', 'weekly_emotional_maps', 'priority_support']
  },
  pro_max: {
    dailyPrompts: -1,
    monthlyJournalEntries: -1,
    dailyMoodTracking: true,
    dailyInsights: -1,
    features: ['everything_in_pro', 'dedicated_coach', 'unlimited_voice_sessions',
              'priority_ai_access', 'custom_integrations', 'advanced_analytics']
  }
};

// Utility functions
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error('Auth error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  return { data, error };
};

const checkUserLimits = async (userId, action) => {
  const { data: profile } = await getUserProfile(userId);
  if (!profile) return { allowed: false, reason: 'Profile not found' };

  const tier = profile.subscription_tier || 'free';
  const limits = TIER_LIMITS[tier];
  
  const today = new Date().toISOString().split('T')[0];
  
  // Check daily prompt limit
  if (action === 'prompt' && limits.dailyPrompts !== -1) {
    const { data: usageData } = await supabase
      .from('daily_usage')
      .select('prompts_used')
      .eq('user_id', userId)
      .eq('date', today)
      .single();
    
    const promptsUsed = usageData?.prompts_used || 0;
    if (promptsUsed >= limits.dailyPrompts) {
      return { 
        allowed: false, 
        reason: `Daily prompt limit reached (${limits.dailyPrompts})`,
        upgrade_suggestion: tier === 'free' ? 'pro' : 'pro_max'
      };
    }
  }
  
  return { allowed: true };
};

const updateUsageStats = async (userId, action) => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: existing } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();
  
  if (existing) {
    const updateData = { ...existing };
    if (action === 'prompt') updateData.prompts_used += 1;
    if (action === 'journal') updateData.journal_entries += 1;
    if (action === 'mood_track') updateData.mood_tracks += 1;
    
    await supabase
      .from('daily_usage')
      .update(updateData)
      .eq('id', existing.id);
  } else {
    const newUsage = {
      user_id: userId,
      date: today,
      prompts_used: action === 'prompt' ? 1 : 0,
      journal_entries: action === 'journal' ? 1 : 0,
      mood_tracks: action === 'mood_track' ? 1 : 0
    };
    
    await supabase
      .from('daily_usage')
      .insert(newUsage);
  }
};

// Claude AI Integration
const callClaudeAPI = async (messages, personality = 'supportive') => {
  try {
    console.log('🧠 Making real Claude API call...');
    
    const personalityPrompts = {
      supportive: "You are a supportive and empathetic AI companion. Respond with warmth and encouragement.",
      professional: "You are a professional AI assistant. Provide clear, structured, and actionable responses.",
      creative: "You are a creative and imaginative AI companion. Think outside the box and inspire creativity.",
      casual: "You are a casual and friendly AI companion. Keep responses conversational and approachable."
    };

    const systemMessage = personalityPrompts[personality] || personalityPrompts.supportive;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemMessage,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Claude API error: ${response.status} - ${errorText}`);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Claude API response received');
    
    return {
      success: true,
      response: data.content[0].text,
      usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        cost: calculateCost(data.usage.input_tokens, data.usage.output_tokens)
      }
    };
  } catch (error) {
    console.error('Claude API Error:', error);
    return {
      success: false,
      error: error.message,
      fallback: "I'm experiencing some technical difficulties. Please try again in a moment."
    };
  }
};

// Simple local AI fallback (for free tier)
const getLocalAIResponse = (message, personality = 'supportive') => {
  console.log('🦙 Using local AI for free tier user...');
  
  const responses = {
    supportive: [
      "I understand how you're feeling. That sounds challenging, but you're taking positive steps by reaching out.",
      "Your feelings are completely valid. Remember that growth often comes from facing difficult situations.",
      "I'm here to listen and support you. What would feel most helpful right now?",
      "It's okay to take things one step at a time. You're doing better than you think.",
      "Thank you for sharing that with me. It takes courage to open up about what you're experiencing."
    ],
    professional: [
      "Based on what you've shared, here are some structured approaches you might consider:",
      "Let's break this down into manageable components to help you move forward effectively.",
      "From a practical standpoint, there are several strategies that could be beneficial here.",
      "I recommend focusing on clear, actionable steps that align with your goals.",
      "This situation presents both challenges and opportunities. Let's identify the key priorities."
    ],
    creative: [
      "What if we looked at this from a completely different angle? Sometimes fresh perspectives unlock new possibilities.",
      "Your situation reminds me of a puzzle waiting to be solved. Let's explore some creative solutions.",
      "There's something beautiful about the complexity of human experience. What if this challenge is actually an opportunity?",
      "Imagination can be a powerful tool here. What would your ideal outcome look like?",
      "Let's think outside the box - what unconventional approaches might work in this situation?"
    ],
    casual: [
      "Hey, that's totally understandable! Lots of people go through similar stuff.",
      "Sounds like you've got a lot on your plate. Want to talk through it step by step?",
      "I hear you! Sometimes life throws curveballs, but you've got this.",
      "That's real talk right there. What's your gut feeling about what to do next?",
      "No worries, we've all been there. What's the most important thing to focus on right now?"
    ]
  };

  const personalityResponses = responses[personality] || responses.supportive;
  return personalityResponses[Math.floor(Math.random() * personalityResponses.length)];
};

const calculateCost = (inputTokens, outputTokens) => {
  // Claude 3.5 Sonnet pricing (approximate)
  const inputCostPer1K = 0.003; // $0.003 per 1K input tokens
  const outputCostPer1K = 0.015; // $0.015 per 1K output tokens
  
  const inputCost = (inputTokens / 1000) * inputCostPer1K;
  const outputCost = (outputTokens / 1000) * outputCostPer1K;
  
  return inputCost + outputCost;
};

// Mood detection function
const detectMood = (message) => {
  const moodKeywords = {
    happy: ['happy', 'excited', 'joy', 'great', 'awesome', 'amazing', 'fantastic', 'wonderful', 'thrilled', 'delighted'],
    sad: ['sad', 'down', 'depressed', 'upset', 'disappointed', 'hurt', 'crying', 'lonely', 'blue', 'miserable'],
    angry: ['angry', 'mad', 'furious', 'frustrated', 'annoyed', 'irritated', 'rage', 'hate', 'pissed'],
    anxious: ['anxious', 'worried', 'nervous', 'stressed', 'overwhelmed', 'panic', 'fear', 'scared', 'tension'],
    calm: ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'content', 'balanced', 'zen'],
    focused: ['focused', 'determined', 'motivated', 'goal', 'plan', 'strategy', 'productive', 'driven'],
    curious: ['curious', 'wonder', 'question', 'how', 'why', 'what', 'learn', 'explore', 'discover']
  };

  const lowerMessage = message.toLowerCase();
  const detected = {};
  
  Object.entries(moodKeywords).forEach(([mood, keywords]) => {
    const matches = keywords.filter(keyword => lowerMessage.includes(keyword));
    if (matches.length > 0) {
      detected[mood] = matches.length / keywords.length;
    }
  });

  if (Object.keys(detected).length === 0) {
    return {
      primary: 'neutral',
      confidence: 0.5,
      all_detected: {}
    };
  }

  const primaryMood = Object.keys(detected).reduce((a, b) => 
    detected[a] > detected[b] ? a : b
  );

  return {
    primary: primaryMood,
    confidence: Math.min(detected[primaryMood] * 2, 1), // Scale confidence
    all_detected: detected
  };
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    claude_api_configured: !!process.env.ANTHROPIC_API_KEY,
    supabase_configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
});

// User profile and subscription info
app.get('/api/user/profile', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await getUserProfile(req.user.id);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Profile fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    // Create profile if it doesn't exist
    if (!data) {
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: req.user.id,
          subscription_tier: 'free',
          subscription_status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Profile creation error:', createError);
        return res.status(500).json({ error: 'Failed to create profile' });
      }

      const tier = 'free';
      const limits = TIER_LIMITS[tier];
      
      return res.json({
        profile: newProfile,
        tier: tier,
        limits: limits,
        today_usage: {
          prompts_used: 0,
          journal_entries: 0,
          mood_tracks: 0
        }
      });
    }

    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const { data: usage } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('date', today)
      .single();

    const tier = data?.subscription_tier || 'free';
    const limits = TIER_LIMITS[tier];
    
    res.json({
      profile: data,
      tier: tier,
      limits: limits,
      today_usage: usage || {
        prompts_used: 0,
        journal_entries: 0,
        mood_tracks: 0
      }
    });
  } catch (error) {
    console.error('Profile route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Chat endpoint
app.post('/api/ai/chat', authenticateUser, aiLimiter, async (req, res) => {
  try {
    const { message, personality = 'supportive', conversation_history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    console.log(`💬 Chat request from user ${req.user.id} with personality: ${personality}`);

    // Check user limits
    const limitCheck = await checkUserLimits(req.user.id, 'prompt');
    if (!limitCheck.allowed) {
      console.log(`❌ User ${req.user.id} hit limit: ${limitCheck.reason}`);
      return res.status(429).json({ 
        error: limitCheck.reason,
        upgrade_suggestion: limitCheck.upgrade_suggestion,
        upgrade_required: true
      });
    }

    // Get user profile to determine AI service
    const { data: profile } = await getUserProfile(req.user.id);
    const tier = profile?.subscription_tier || 'free';
    
    console.log(`👤 User tier: ${tier}`);
    
    // Detect mood
    const moodAnalysis = detectMood(message);
    console.log(`😊 Detected mood: ${moodAnalysis.primary} (${Math.round(moodAnalysis.confidence * 100)}%)`);
    
    let aiResponse;
    let cost = 0;
    
    if (tier === 'free') {
      // Use local AI for free tier
      aiResponse = {
        success: true,
        response: getLocalAIResponse(message, personality),
        usage: { input_tokens: 0, output_tokens: 0, cost: 0 },
        ai_provider: 'local'
      };
    } else {
      // Use Claude for Pro/Pro Max tiers
      const messages = [
        ...conversation_history.slice(-5), // Last 5 messages for context
        { role: 'user', content: message }
      ];
      
      console.log(`🚀 Using Claude API for ${tier} user...`);
      aiResponse = await callClaudeAPI(messages, personality);
      aiResponse.ai_provider = 'claude';
      cost = aiResponse.usage?.cost || 0;
      
      if (cost > 0) {
        console.log(`💰 Claude API cost: $${cost.toFixed(4)}`);
      }
    }

    // Update usage stats
    await updateUsageStats(req.user.id, 'prompt');
    console.log(`📊 Updated usage stats for user ${req.user.id}`);
    
    // Save conversation to database
    const { data: conversation, error: saveError } = await supabase
      .from('conversations')
      .insert({
        user_id: req.user.id,
        message: message,
        response: aiResponse.response || aiResponse.fallback,
        personality: personality,
        mood_detected: moodAnalysis.primary,
        mood_confidence: moodAnalysis.confidence,
        ai_provider: aiResponse.ai_provider,
        cost: cost,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save conversation:', saveError);
    } else {
      console.log(`💾 Saved conversation ${conversation.id}`);
    }

    // Get updated usage for response
    const currentUsage = await getCurrentUsage(req.user.id, 'prompts');

    res.json({
      response: aiResponse.response || aiResponse.fallback,
      mood_analysis: moodAnalysis,
      ai_provider: aiResponse.ai_provider,
      usage: aiResponse.usage,
      conversation_id: conversation?.id,
      limits_remaining: tier === 'free' ? {
        prompts: Math.max(0, TIER_LIMITS.free.dailyPrompts - currentUsage - 1)
      } : null
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      fallback: "I'm experiencing technical difficulties. Please try again."
    });
  }
});

// Get current usage for a user
const getCurrentUsage = async (userId, type) => {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('daily_usage')
    .select(`${type}_used`)
    .eq('user_id', userId)
    .eq('date', today)
    .single();
  
  return data?.[`${type}_used`] || 0;
};

// Mood tracking endpoint
app.post('/api/mood/track', authenticateUser, async (req, res) => {
  try {
    const { mood, intensity, notes } = req.body;
    
    if (!mood || !intensity) {
      return res.status(400).json({ error: 'Mood and intensity are required' });
    }

    console.log(`😊 Mood tracking for user ${req.user.id}: ${mood} (${intensity}/10)`);
    
    // Save mood entry
    const { data, error } = await supabase
      .from('mood_entries')
      .insert({
        user_id: req.user.id,
        mood: mood,
        intensity: intensity,
        notes: notes || '',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Mood tracking error:', error);
      throw error;
    }

    // Update usage stats
    await updateUsageStats(req.user.id, 'mood_track');

    res.json({ success: true, entry: data });
  } catch (error) {
    console.error('Mood tracking error:', error);
    res.status(500).json({ error: 'Failed to save mood entry' });
  }
});

// Journal endpoints
app.post('/api/journal/entry', authenticateUser, async (req, res) => {
  try {
    const { title, content, mood } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Check limits for free tier
    const limitCheck = await checkUserLimits(req.user.id, 'journal');
    if (!limitCheck.allowed) {
      return res.status(429).json({ 
        error: limitCheck.reason,
        upgrade_suggestion: limitCheck.upgrade_suggestion
      });
    }

    console.log(`📝 Journal entry for user ${req.user.id}`);

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: req.user.id,
        title: title || '',
        content: content,
        mood: mood || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await updateUsageStats(req.user.id, 'journal');

    res.json({ success: true, entry: data });
  } catch (error) {
    console.error('Journal entry error:', error);
    res.status(500).json({ error: 'Failed to save journal entry' });
  }
});

// Get user analytics
app.get('/api/analytics/summary', authenticateUser, async (req, res) => {
  try {
    const { data: profile } = await getUserProfile(req.user.id);
    const tier = profile?.subscription_tier || 'free';
    
    if (tier === 'free') {
      return res.status(403).json({ 
        error: 'Analytics require Pro subscription',
        upgrade_suggestion: 'pro'
      });
    }

    console.log(`📊 Analytics request for ${tier} user ${req.user.id}`);

    // Get last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [usageData, moodData, conversationData] = await Promise.all([
      supabase
        .from('daily_usage')
        .select('*')
        .eq('user_id', req.user.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]),
      
      supabase
        .from('mood_entries')
        .select('mood, intensity, created_at')
        .eq('user_id', req.user.id)
        .gte('created_at', thirtyDaysAgo.toISOString()),
      
      supabase
        .from('conversations')
        .select('mood_detected, mood_confidence, created_at')
        .eq('user_id', req.user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
    ]);

    res.json({
      usage_trends: usageData.data || [],
      mood_patterns: moodData.data || [],
      conversation_insights: conversationData.data || [],
      summary_period: '30_days'
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// Subscription management
app.post('/api/subscription/upgrade', authenticateUser, async (req, res) => {
  try {
    const { tier, payment_method: _payment_method } = req.body;
    
    if (!['pro', 'pro_max'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }

    console.log(`💳 Subscription upgrade for user ${req.user.id} to ${tier}`);

    // In production, integrate with Stripe here
    // For demo purposes, we'll simulate the upgrade
    
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: req.user.id,
        subscription_tier: tier,
        subscription_status: 'active',
        subscription_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Subscription upgrade error:', error);
      throw error;
    }

    console.log(`✅ User ${req.user.id} upgraded to ${tier}`);

    res.json({ 
      success: true, 
      message: `Successfully upgraded to ${tier} tier`,
      new_tier: tier,
      features_unlocked: TIER_LIMITS[tier].features
    });

  } catch (error) {
    console.error('Subscription upgrade error:', error);
    res.status(500).json({ error: 'Failed to upgrade subscription' });
  }
});

// Test Claude API endpoint (for debugging)
app.post('/api/test/claude', authenticateUser, async (req, res) => {
  try {
    const { message = 'Hello from Atlas backend!' } = req.body;
    
    console.log('🧪 Testing Claude API...');
    
    const testResponse = await callClaudeAPI([
      { role: 'user', content: message }
    ], 'supportive');
    
    res.json({
      test_successful: testResponse.success,
      response: testResponse.response || testResponse.fallback,
      error: testResponse.error || null,
      usage: testResponse.usage || null
    });
    
  } catch (error) {
    console.error('Claude test error:', error);
    res.status(500).json({ 
      test_successful: false,
      error: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, _next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Atlas AI Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧠 Claude API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`🗄️ Supabase: ${process.env.SUPABASE_URL ? '✅ Configured' : '❌ Missing'}`);
});

module.exports = app; 