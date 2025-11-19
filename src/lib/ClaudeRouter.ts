import { getClaudeModelName, tierFeatures } from '@/config/featureAccess';
import { subscriptionApi } from '../services/subscriptionApi';
import { supabase } from './supabaseClient';

// Types
export interface ClaudePrompt {
  id: string;
  content: string;
  model: 'claude-3-sonnet-20240229' | 'claude-3-opus-20240229' | 'claude-3-haiku-20240307';
  userTier: 'core' | 'studio';
  timestamp: Date;
  cached?: boolean;
}

export interface ClaudeResponse {
  id: string;
  content: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  cached: boolean;
}

export type UserTier = 'free' | 'core' | 'studio';

// Claude API configuration
const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;
const CLAUDE_BASE_URL = 'https://api.anthropic.com/v1/messages';

/**
 * ✅ Get user tier from Supabase using centralized API
 */
export async function getUserTier(userId: string): Promise<UserTier> {
  try {
    // Get access token for backend API calls
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    
    if (!accessToken) {
      return 'free';
    }

    // ✅ Use centralized subscription API service
    const tier = await subscriptionApi.getUserTier(userId, accessToken);
    
    return tier;
  } catch (error) {
    return 'free'; // Default to free tier
  }
}

/**
 * Get cached prompt from Supabase
 */
export async function getCachedPrompt(
  promptHash: string,
  userId: string
): Promise<ClaudeResponse | null> {
  try {
    const { data, error } = await supabase
      .from('claude_cache')
      .select('*')
      .eq('prompt_hash', promptHash)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      content: data.response_content,
      model: data.model,
      usage: {
        input_tokens: data.input_tokens,
        output_tokens: data.output_tokens,
      },
      cached: true,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Cache prompt response in Supabase
 */
export async function cachePrompt(
  promptHash: string,
  userId: string,
  response: ClaudeResponse
): Promise<void> {
  try {
    const { error } = await supabase.from('claude_cache').insert({
      prompt_hash: promptHash,
      user_id: userId,
      response_content: response.content,
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Silently fail cache writes - non-critical operation
    }
  } catch (error) {
    // Silently fail cache writes - non-critical operation
  }
}

/**
 * ✅ Route prompt to appropriate Claude model based on user tier using centralized config
 */
export function routePrompt(userTier: UserTier): string {
  return getClaudeModelName(userTier);
}

/**
 * Generate hash for prompt caching
 */
function generatePromptHash(content: string, userId: string): string {
  const combined = `${content}:${userId}`;
  return btoa(combined).replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Main prompt handler with caching and routing
 */
export async function handlePrompt(
  content: string,
  userId: string
): Promise<ClaudeResponse> {
  // Get user tier
  const userTier = await getUserTier(userId);
  
  // Route to appropriate model
  const model = routePrompt(userTier);
  
  // Generate prompt hash for caching
  const promptHash = generatePromptHash(content, userId);
  
  // Check cache first
  const cachedResponse = await getCachedPrompt(promptHash, userId);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // ✅ Make API call to Claude using tier config
  const tierConfig = tierFeatures[userTier];
  const response = await fetch(CLAUDE_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: tierConfig.maxTokensPerResponse,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  
  const claudeResponse: ClaudeResponse = {
    id: data.id,
    content: data.content[0].text,
    model: data.model,
    usage: data.usage,
    cached: false,
  };

  // Cache the response
  await cachePrompt(promptHash, userId, claudeResponse);
  
  return claudeResponse;
}

/**
 * Get Claude model info for UI display
 */
export function getModelInfo(model: string) {
  const models = {
    'claude-3-5-sonnet-latest': {
      name: 'Claude 3.5 Sonnet',
      description: 'Fast and efficient for most tasks',
      tier: 'core' as const,
    },
    'claude-3-5-haiku-latest': {
      name: 'Claude 3.5 Haiku',
      description: 'Fast and cost-effective',
      tier: 'free' as const,
    },
    'claude-sonnet-4-5-20250929': {
      name: 'Claude Sonnet 4.5',
      description: 'Fast and efficient for most tasks',
      tier: 'core' as const,
    },
    // Legacy model names for backward compatibility
    'claude-3-sonnet-20240229': {
      name: 'Claude 3 Sonnet',
      description: 'Fast and efficient for most tasks',
      tier: 'core' as const,
    },
    'claude-3-opus-20240229': {
      name: 'Claude 3 Opus',
      description: 'Most capable model for complex tasks',
      tier: 'studio' as const,
    },
    'claude-3-haiku-20240307': {
      name: 'Claude 3 Haiku',
      description: 'Fast and cost-effective',
      tier: 'free' as const,
    },
    // Legacy model names for backward compatibility
    'claude-3-5-sonnet': {
      name: 'Claude 3 Sonnet',
      description: 'Fast and efficient for most tasks',
      tier: 'core' as const,
    },
    'claude-3-5-opus': {
      name: 'Claude 3 Opus',
      description: 'Most capable model for complex tasks',
      tier: 'studio' as const,
    },
  };
  
  return models[model as keyof typeof models] || models['claude-3-5-sonnet-latest'];
}
