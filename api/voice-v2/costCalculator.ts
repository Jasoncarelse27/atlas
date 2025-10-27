/**
 * Voice V2 Cost Calculator
 * Calculates costs for Deepgram STT, Claude LLM, and OpenAI TTS
 */

// Pricing (as of October 2025)
const PRICING = {
  // Deepgram STT: $0.0043 per minute (Nova-2 model)
  deepgramPerMinute: 0.0043,
  
  // Claude Haiku: $0.25 per 1M input tokens, $1.25 per 1M output tokens
  claudeHaikuInputPer1M: 0.25,
  claudeHaikuOutputPer1M: 1.25,
  
  // OpenAI TTS (tts-1): $15 per 1M characters
  openaiTTSPer1M: 15.0,
};

/**
 * Calculate Deepgram STT cost
 * @param durationMs - Duration in milliseconds
 * @returns Cost in dollars
 */
export function calculateDeepgramCost(durationMs: number): number {
  const minutes = durationMs / 60000;
  return minutes * PRICING.deepgramPerMinute;
}

/**
 * Calculate Claude Haiku cost
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in dollars
 */
export function calculateClaudeCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * PRICING.claudeHaikuInputPer1M;
  const outputCost = (outputTokens / 1_000_000) * PRICING.claudeHaikuOutputPer1M;
  return inputCost + outputCost;
}

/**
 * Calculate OpenAI TTS cost
 * @param characters - Number of characters
 * @returns Cost in dollars
 */
export function calculateTTSCost(characters: number): number {
  return (characters / 1_000_000) * PRICING.openaiTTSPer1M;
}

/**
 * Calculate total session cost
 * @param metrics - Session metrics
 * @returns Total cost in dollars
 */
export interface SessionMetrics {
  deepgramDurationMs: number;
  claudeInputTokens: number;
  claudeOutputTokens: number;
  ttsCharacters: number;
}

export function calculateTotalCost(metrics: SessionMetrics): number {
  const sttCost = calculateDeepgramCost(metrics.deepgramDurationMs);
  const llmCost = calculateClaudeCost(metrics.claudeInputTokens, metrics.claudeOutputTokens);
  const ttsCost = calculateTTSCost(metrics.ttsCharacters);
  
  return sttCost + llmCost + ttsCost;
}

/**
 * Calculate cost breakdown for detailed reporting
 */
export interface CostBreakdown {
  stt: number;
  llm: number;
  tts: number;
  total: number;
}

export function calculateCostBreakdown(metrics: SessionMetrics): CostBreakdown {
  const stt = calculateDeepgramCost(metrics.deepgramDurationMs);
  const llm = calculateClaudeCost(metrics.claudeInputTokens, metrics.claudeOutputTokens);
  const tts = calculateTTSCost(metrics.ttsCharacters);
  
  return {
    stt,
    llm,
    tts,
    total: stt + llm + tts,
  };
}

/**
 * Format cost for display
 * @param cost - Cost in dollars
 * @returns Formatted string (e.g., "$0.0234")
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Check if cost exceeds limit
 * @param cost - Current cost
 * @param limit - Maximum allowed cost
 * @returns True if limit exceeded
 */
export function isOverBudget(cost: number, limit: number): boolean {
  return cost >= limit;
}

/**
 * Check if approaching budget limit (>80%)
 * @param cost - Current cost
 * @param limit - Maximum allowed cost
 * @returns True if approaching limit
 */
export function isApproachingBudget(cost: number, limit: number): boolean {
  return cost >= limit * 0.8;
}

