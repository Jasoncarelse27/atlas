// Atlas Enhanced Tier Gate System (backend, ESM, no removals)

export const TIER_DEFINITIONS = {
  free:   { dailyMessages: 15, models: ['haiku'],              features: ['basic_chat','habit_logging'],                     budgetCeiling: 20,  priority: 1, monthlyPrice: 0 },
  core:   { dailyMessages: -1, models: ['haiku','sonnet'],     features: ['all_basic','persistent_memory','eq_challenges'],  budgetCeiling: 100, priority: 2, monthlyPrice: 19.99 },
  studio: { dailyMessages: -1, models: ['haiku','sonnet','opus'], features: ['all_features','priority_processing','advanced_analytics'], budgetCeiling: 80, priority: 3, monthlyPrice: 179.99 }
};

export const FEATURE_GATES = {
  voice_analysis: ['core','studio'],
  advanced_insights: ['studio'],
  priority_processing: ['studio'],
  persistent_memory: ['core','studio']
};

export const MODEL_COSTS = {
  'claude-3-haiku':  { input: 0.00025, output: 0.00125 },
  'claude-3-sonnet': { input: 0.003,   output: 0.015   },
  'claude-3-opus':   { input: 0.015,   output: 0.075   }
};

export const PROMPT_CACHE_CONFIG = {
  systemPersonality: { cacheTTL: 24*60*60*1000, estimatedTokens: 2000 },
  habitFramework:    { cacheTTL: 12*60*60*1000, estimatedTokens: 500  },
  eqChallenges:      { cacheTTL: 24*60*60*1000, estimatedTokens: 800  }
};

export const SYSTEM_LIMITS = {
  maxDailySpend: 200,
  emergencyShutoff: 250,
  highTrafficThreshold: 150
};

export function selectOptimalModel(userTier, messageContent = '', requestType = '') {
  if (userTier === 'free') return 'claude-3-haiku';

  const msg = `${requestType} ${messageContent}`.toLowerCase();
  const wc  = msg.trim().split(/\s+/).filter(Boolean).length;

  const isSimple = wc <= 5 || /^(hi|hello|hey|thanks?|ok|okay)\b/.test(msg);
  if (isSimple) return 'claude-3-haiku';

  // Check for complexity first for Studio users to get Opus for complex requests
  const isComplex = wc > 100 || /(deep dive|comprehensive|detailed breakdown|multiple factors|long-term strategy|analysis|patterns)/.test(msg) || msg.split('.').length > 5;
  if (userTier === 'studio' && isComplex) return 'claude-3-opus';

  const needsEmotional = /(feel|emotion|mood|anxiety|depress|stress|relationship|overwhelmed|mental health)/.test(msg);
  if (needsEmotional) return 'claude-3-sonnet';

  return 'claude-3-sonnet';
}

export function estimateRequestCost(model, inputTokens = 0, outputTokens = 0) {
  const c = MODEL_COSTS[model];
  if (!c) return 0;
  return (inputTokens * c.input / 1000) + (outputTokens * c.output / 1000);
}
