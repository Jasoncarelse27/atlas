import { useCallback, useMemo } from 'react';
import type { UserTier } from './useSubscriptionAccess';

export type SupportedModel = 'claude'  | 'opus' | 'haiku';

interface AIProviderConfig {
  provider: SupportedModel;
  endpoint: string;
  headers: Record<string, string>;
  model: string;
  maxTokens: number;
  temperature: number;
}

interface UseAIProviderParams {
  userTier: UserTier;
  selectedModel?: SupportedModel;
}

// Helper function to get environment variables safely
const getEnvVar = (key: string): string => {
  if (typeof window !== 'undefined' && (window as Record<string, unknown>).__ENV__) {
    return (window as Record<string, unknown>).__ENV__[key] as string || '';
  }
  // Fallback for development
  return process.env[key] || '';
};

export function useAIProvider({ userTier, selectedModel }: UseAIProviderParams) {
  
  // Get the appropriate AI provider configuration based on tier and selection
  const getProviderConfig = useCallback((
    tier: UserTier, 
    model?: SupportedModel
  ): AIProviderConfig => {
    // If user explicitly selected a model, respect that choice
    if (model) {
      return getModelConfig(model);
    }

    // Otherwise, route based on tier
    switch (tier) {
      case 'free':
        return getModelConfig('haiku'); // Free tier uses Claude Haiku 3.5 (fastest, cost-effective)
      case 'core':
        return getModelConfig('claude'); // Core tier uses Claude Sonnet
      case 'studio':
        return getModelConfig('opus'); // Studio tier uses Claude Opus
      default:
        return getModelConfig('haiku'); // Fallback to Haiku
    }
  }, []);

  // Get specific model configuration
  const getModelConfig = useCallback((model: SupportedModel): AIProviderConfig => {
    switch (model) {
      case 'claude':
        return {
          provider: 'claude',
          endpoint: '/api/claude',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getEnvVar('VITE_CLAUDE_API_KEY')}`,
          },
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
          temperature: 0.7
        };
      
      case 'opus':
        return {
          provider: 'opus',
          endpoint: '/api/claude',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getEnvVar('VITE_CLAUDE_API_KEY')}`,
          },
          model: 'claude-3-5-opus-20241022',
          maxTokens: 4096,
          temperature: 0.7
        };
      
      case 'haiku':
        return {
          provider: 'haiku',
          endpoint: '/api/claude',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getEnvVar('VITE_CLAUDE_API_KEY')}`,
          },
          model: 'claude-3-5-haiku-20241022',
          maxTokens: 4096,
          temperature: 0.7
        };
      
      default:
        return getModelConfig('haiku');
    }
  }, []);

  // Get current provider configuration
  const currentProvider = useMemo(() => {
    return getProviderConfig(userTier, selectedModel);
  }, [userTier, selectedModel, getProviderConfig]);

  // Get fallback provider (used when primary provider fails)
  const getFallbackProvider = useCallback((failedProvider: SupportedModel): AIProviderConfig => {
    switch (failedProvider) {
      case 'opus':
        // If Opus fails, fallback to Claude Sonnet
        return getModelConfig('claude');
      case 'claude':
        // If Claude fails, fallback to Haiku
        return getModelConfig('haiku');
      case 'haiku':
        // If Haiku fails, fallback to Haiku
        return getModelConfig('haiku');
      default:
        return getModelConfig('haiku');
    }
  }, []);

  // Check if provider supports specific features
  const supportsFeature = useCallback((feature: string): boolean => {
    switch (currentProvider.provider) {
      case 'opus':
        return ['text', 'voice', 'image', 'vision', 'code', 'analysis'].includes(feature);
      case 'claude':
        return ['text', 'voice', 'image', 'vision', 'code'].includes(feature);
      case 'haiku':
        return ['text', 'voice', 'image', 'vision', 'code'].includes(feature);
      default:
        return false;
    }
  }, [currentProvider.provider]);

  // Get provider capabilities summary
  const getProviderCapabilities = useCallback(() => {
    const capabilities = {
      text: supportsFeature('text'),
      voice: supportsFeature('voice'),
      image: supportsFeature('image'),
      vision: supportsFeature('vision'),
      code: supportsFeature('code'),
      analysis: supportsFeature('analysis')
    };

    return {
      ...capabilities,
      summary: Object.entries(capabilities)
        .filter(([, supported]) => supported)
        .map(([feature]) => feature)
        .join(', ')
    };
  }, [supportsFeature]);

  // Get provider cost information (for user awareness)
  const getProviderCost = useCallback(() => {
    switch (currentProvider.provider) {
      case 'haiku':
        return { perToken: 0.00000025, model: 'claude-3-5-haiku' }; // Fastest, cost-effective
      case 'claude':
        return { perToken: 0.000003, model: 'claude-3-5-sonnet-20241022' }; // Balanced
      case 'opus':
        return { perToken: 0.000015, model: 'claude-3-5-opus-20241022' }; // Most capable
      default:
        return { perToken: 0.00000025, model: 'claude-3-5-haiku' }; // Fallback
    }
  }, [currentProvider.provider]);

  return {
    // Current provider configuration
    currentProvider,
    
    // Provider selection
    getProviderConfig,
    getFallbackProvider,
    
    // Feature support
    supportsFeature,
    getProviderCapabilities,
    
    // Cost information
    getProviderCost,
    
    // Utility functions
    isFreeTier: userTier === 'free',
    isCoreTier: userTier === 'core',
    isStudioTier: userTier === 'studio'
  };
}
