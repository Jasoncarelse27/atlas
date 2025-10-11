// backend/middleware/promptCacheMiddleware.mjs

/**
 * Middleware to cache and retrieve prompt responses for efficiency
 */
export default async function promptCacheMiddleware(req, res, next) {
  try {
    const { message, tier } = req.body || {};
    
    if (!message || !tier) {
      return next(); // Skip caching if required data is missing
    }

    // Generate cache key based on message and tier
    const cacheKey = generateCacheKey(message, tier);
    
    try {
      // Check for cached response
      const { supabase } = await import('../config/supabaseClient.mjs');
      const { data: cachedResponse, error } = await supabase
        .from('prompt_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .eq('tier', tier)
        .single();

      if (!error && cachedResponse) {
        // Return cached response
        req.cachedPrompt = cachedResponse;
        req.cacheHit = true;
        return next();
      }

      // No cache hit, proceed with normal processing
      req.cacheHit = false;
      return next();

    } catch (dbError) {
      req.cacheHit = false;
      return next();
    }

  } catch (error) {
    req.cacheHit = false;
    return next(); // Continue processing even if caching fails
  }
}

/**
 * Cache a prompt response for future use
 */
export async function cachePromptResponse(prompt, response, tier, tokenCount, cost) {
  try {
    const cacheKey = generateCacheKey(prompt, tier);
    const { supabase } = await import('../config/supabaseClient.mjs');
    
    const { error } = await supabase
      .from('prompt_cache')
      .insert({
        cache_key: cacheKey,
        prompt: prompt,
        response: response,
        tier: tier,
        token_count: tokenCount,
        cost: cost,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.log('Cache error:', error.message);
    } else {
      console.log('Cache success');
    }
  } catch (error) {
    console.log('Cache catch error:', error.message);
  }
}

/**
 * Generate a cache key from prompt and tier
 */
function generateCacheKey(prompt, tier) {
  // Simple hash function for cache key generation
  const input = `${prompt}-${tier}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}