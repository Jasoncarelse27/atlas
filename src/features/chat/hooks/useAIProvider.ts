import { getClaudeModelName, tierFeatures } from '@/config/featureAccess';
import { useCallback, useMemo } from 'react';

type UserTier = 'free' | 'core' | 'studio';

export type SupportedModel = 'claude' | 'groq' | 'opus';

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
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    return (window as any).__ENV__[key] || '';
  }
  // Use Vite environment variables
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || '';
  }
  return '';
};

export function useAIProvider({ userTier, selectedModel }: UseAIProviderParams) {
  
  // ✅ Get the appropriate AI provider configuration based on tier config
  const getProviderConfig = useCallback((
    tier: UserTier, 
    model?: SupportedModel
  ): AIProviderConfig => {
    // If user explicitly selected a model, respect that choice
    if (model) {
      return getModelConfig(model);
    }

    // ✅ Use tier config to determine model
    const tierConfig = tierFeatures[tier];
    const modelName = tierConfig.model;
    
    // Map config model to provider
    if (modelName.includes('opus')) {
      return getModelConfig('opus');
    } else if (modelName.includes('sonnet')) {
      return getModelConfig('claude');
    } else {
      return getModelConfig('groq'); // Haiku/free tier
    }
  }, []);

  // ✅ Get specific model configuration using centralized tier config
  const getModelConfig = useCallback((model: SupportedModel): AIProviderConfig => {
    switch (model) {
      case 'groq':
        return {
          provider: 'groq',
          endpoint: '/api/groq',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getEnvVar('VITE_GROQ_API_KEY')}`,
          },
          model: 'llama3.3-70b-versatile',
          maxTokens: 4096,
          temperature: 0.7
        };
      
      case 'claude':
        return {
          provider: 'claude',
          endpoint: '/api/claude',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getEnvVar('VITE_CLAUDE_API_KEY')}`,
          },
          model: getClaudeModelName('core'), // ✅ Use centralized config
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
          model: getClaudeModelName('studio'), // ✅ Use centralized config
          maxTokens: 4096,
          temperature: 0.7
        };
      
      default:
        return getModelConfig('groq');
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
        // If Claude fails, fallback to Groq
        return getModelConfig('groq');
      case 'groq':
        // If Groq fails, fallback to Claude
        return getModelConfig('claude');
      default:
        return getModelConfig('groq');
    }
  }, [getModelConfig]);

  // Check if provider supports specific features
  const supportsFeature = useCallback((feature: string): boolean => {
    switch (currentProvider.provider) {
      case 'opus':
        return ['text', 'voice', 'image', 'vision', 'code', 'analysis'].includes(feature);
      case 'claude':
        return ['text', 'voice', 'image', 'vision', 'code'].includes(feature);
      case 'groq':
        return ['text', 'code'].includes(feature);
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
      case 'groq':
        return { perToken: 0.0000002, model: 'llama3.3-70b-versatile' }; // Very cheap
      case 'claude':
        return { perToken: 0.000003, model: 'claude-3-sonnet-20240229' }; // ✅ Billing-enabled model (claude-3-5-sonnet-latest returns 404)
      case 'opus':
        return { perToken: 0.000015, model: 'claude-3-sonnet-20240229' }; // ✅ Changed from Opus to Sonnet (billing-enabled, claude-3-5-sonnet-latest returns 404)
      default:
        return { perToken: 0.0000002, model: 'unknown' };
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
    
    // ✅ Tier info (removed hardcoded checks)
    userTier
  };
}
