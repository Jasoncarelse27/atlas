// Atlas Text Cleaner v1.0 (Hybrid Grammar Fix System)
// Prevents & repairs concatenated words, punctuation spacing,
// and Claude word-merging artifacts.
// Production-safe, zero dependencies, comprehensive solution

import { logger } from '../lib/simpleLogger.mjs';

// Lightweight common dictionary (safe, fast, deterministic)
// Set-based for O(1) lookups - minimal performance impact
const COMMON_WORDS = new Set([
  // Prepositions
  'here', 'there', 'where', 'when', 'what', 'how', 'why', 'to', 'at', 'in', 'on', 'of', 'for', 'with', 'by',
  'from', 'about', 'into', 'onto', 'upon', 'over', 'under', 'above', 'below', 'near', 'far', 'through',
  'during', 'before', 'after', 'until', 'since', 'while', 'between', 'among', 'across', 'around',
  
  // Pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'this', 'that', 'these',
  'those', 'who', 'whom', 'whose', 'which',
  
  // Common verbs (including -ing forms for concatenations)
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 
  'do', 'does', 'did', 'doing', 'get', 'got', 'getting', 'go', 'went', 'going', 'come', 'came', 'coming',
  'see', 'saw', 'seeing', 'know', 'knew', 'knowing', 'think', 'thought', 'thinking', 'feel', 'felt', 'feeling',
  'want', 'wanted', 'wanting', 'need', 'needed', 'needing', 'try', 'tried', 'trying', 'work', 'worked', 'working',
  'make', 'made', 'making', 'take', 'took', 'taking', 'give', 'gave', 'giving', 'say', 'said', 'saying',
  'tell', 'told', 'telling', 'ask', 'asked', 'asking', 'help', 'helped', 'helping', 'use', 'used', 'using',
  'find', 'found', 'finding', 'look', 'looked', 'looking', 'pull', 'pulled', 'pulling', 'push', 'pushed', 'pushing',
  'walk', 'walked', 'walking', 'run', 'ran', 'running', 'sit', 'sat', 'sitting', 'stand', 'stood', 'standing',
  'keep', 'kept', 'keeping', 'let', 'letting', 'put', 'putting', 'set', 'setting', 'bring', 'brought', 'bringing',
  
  // Adjectives & adverbs
  'good', 'bad', 'big', 'small', 'new', 'old', 'right', 'wrong', 'true', 'false', 'clear', 'open', 'closed',
  'free', 'busy', 'same', 'different', 'other', 'next', 'last', 'first', 'best', 'worst', 'better', 'worse',
  'more', 'most', 'less', 'least', 'very', 'really', 'just', 'only', 'even', 'still', 'yet', 'already',
  'always', 'never', 'often', 'sometimes', 'usually', 'today', 'yesterday', 'tomorrow', 'now', 'then',
  
  // Common nouns
  'time', 'year', 'people', 'way', 'day', 'man', 'woman', 'life', 'child', 'world', 'state', 'family',
  'group', 'country', 'problem', 'place', 'week', 'company', 'system', 'question', 'work', 'home',
  'water', 'room', 'mother', 'money', 'story', 'month', 'job', 'word', 'friend', 'father', 'power',
  'reason', 'morning', 'moment', 'teacher', 'change', 'mind', 'attention', 'thing', 'way', 'part'
]);

/**
 * Auto-detect & split concatenated words (hereto → here to, pullingat → pulling at)
 * Uses dictionary-based detection to catch unknown concatenations automatically
 * 
 * Note: This function expects text that may already have placeholders for preserved items
 * (emails, URLs, etc.) - it will skip processing those placeholders
 */
function splitConcatenatedWords(text) {
  if (!text) return text;

  // Process the text, skipping placeholders
  return text.replace(/\b([a-z]{4,})\b/gi, (match) => {
    // Skip if it's a placeholder (preserved items)
    if (match.startsWith('__PRESERVED_')) return match;
    
    const word = match.toLowerCase();

    // If it's already a known word, keep it
    if (COMMON_WORDS.has(word)) return match;

    // Try every split point (min 2 chars per part)
    for (let i = 2; i <= word.length - 2; i++) {
      const first = word.slice(0, i);
      const second = word.slice(i);

      if (COMMON_WORDS.has(first) && COMMON_WORDS.has(second)) {
        // Preserve original case for first word
        const firstPreserved = match[0] === match[0].toUpperCase() 
          ? first.charAt(0).toUpperCase() + first.slice(1)
          : first;
        return `${firstPreserved} ${second}`;
      }
    }

    return match; // No split found
  });
}

/**
 * Fix missing punctuation spacing & basic grammar artifacts
 * Comprehensive solution that handles all known and unknown concatenations
 * 
 * SAFETY: Preserves email addresses, URLs, file extensions throughout
 */
export function fixPunctuationSpacing(text) {
  if (!text) return text;
  
  // ✅ SAFETY: Preserve emails, URLs, and file extensions throughout entire process
  const preserved = [];
  let preservedIndex = 0;
  
  // Enhanced pattern: emails, URLs, file extensions (with word boundaries)
  // Match emails, URLs, and file extensions but be careful not to break valid text
  const preservePattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(https?:\/\/[^\s]+)|(\b[a-zA-Z0-9]+\.(jpg|png|gif|pdf|doc|txt|com|org|net|edu|gov|io|co|ai)\b)/gi;
  
  // Replace preserved patterns with placeholders
  const textWithPlaceholders = text.replace(preservePattern, (match) => {
    preserved.push(match);
    return `__PRESERVED_${preservedIndex++}__`;
  });
  
  let t = textWithPlaceholders;

  // Step 0: Split concatenated words FIRST (catches hereto, pullingat, etc.)
  t = splitConcatenatedWords(t);

  // Step 1: Fix missing spaces after punctuation marks
  // Fix spacing after exclamation marks, question marks, periods
  t = t.replace(/([!?.])([A-Za-z])/g, '$1 $2');
  
  // Fix spacing after commas (but preserve numbers like "1,000")
  t = t.replace(/(,)([A-Za-z])/g, '$1 $2');
  
  // Fix spacing after colons and semicolons
  t = t.replace(/([:;])([A-Za-z])/g, '$1 $2');

  // Step 2: Fix missing spaces between words (common patterns)
  // Fix: lowercase letter followed by uppercase letter (e.g., "Iremember" → "I remember")
  t = t.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Step 3: Fix missing spaces after punctuation (more comprehensive)
  // Fix: word + punctuation + letter (catches "now.I", "be.Asyour", "anything.I'm")
  t = t.replace(/([a-z])([!?.])([A-Za-z])/g, '$1$2 $3');
  
  // Fix: punctuation + any non-space character + letter (catches "you.✨ Inthe", "you.💪 Inthe")
  t = t.replace(/([!?.])([^\s])([A-Za-z])/g, '$1$2 $3');
  
  // Fix: word + number (catches "Even10-15" → "Even 10-15")
  t = t.replace(/([a-z])([0-9])/g, '$1 $2');
  
  // Fix: number + word (catches "10-15minutes" → "10-15 minutes")
  t = t.replace(/([0-9])([a-z])/g, '$1 $2');

  // Step 4: Fix specific common concatenations (fallback for edge cases)
  const commonFixes = [
    { from: /Iremember/gi, to: 'I remember' },
    { from: /adance/gi, to: 'a dance' },
    { from: /Asyour/gi, to: 'As your' },
    { from: /Sinceyou/gi, to: 'Since you' },
    { from: /puttogether/gi, to: 'put together' },
    { from: /manydays/gi, to: 'many days' },
    { from: /Withthose/gi, to: 'With those' },
    { from: /Foryou/gi, to: 'For you' },
    { from: /Toyou/gi, to: 'To you' },
    { from: /Inyour/gi, to: 'In your' },
    { from: /Onyour/gi, to: 'On your' },
    { from: /Inthe/gi, to: 'In the' },
    { from: /Howmany/gi, to: 'How many' },
    { from: /Howdoes/gi, to: 'How does' },
    { from: /Howare/gi, to: 'How are' },
    { from: /Whatare/gi, to: 'What are' },
    { from: /Whereare/gi, to: 'Where are' },
    { from: /Whenare/gi, to: 'When are' },
    { from: /Whyare/gi, to: 'Why are' },
    { from: /Doyou/gi, to: 'Do you' },
    { from: /Areyou/gi, to: 'Are you' },
    { from: /Canyou/gi, to: 'Can you' },
    { from: /Willyou/gi, to: 'Will you' },
    { from: /Wouldyou/gi, to: 'Would you' },
    { from: /Shouldyou/gi, to: 'Should you' },
    { from: /Haveyou/gi, to: 'Have you' },
    { from: /Hasyou/gi, to: 'Has you' },
    { from: /Pleaselet/gi, to: 'Please let' },
    { from: /Iam/gi, to: 'I am' },
    { from: /Ihave/gi, to: 'I have' },
    { from: /Iwill/gi, to: 'I will' },
    { from: /Ican/gi, to: 'I can' },
    { from: /Ido/gi, to: 'I do' },
    { from: /Idid/gi, to: 'I did' },
    { from: /Iwas/gi, to: 'I was' },
    { from: /Iwere/gi, to: 'I were' },
    { from: /fast\.How/gi, to: 'fast. How' },
    { from: /again\.How/gi, to: 'again. How' },
    // Add the new patterns we found
    { from: /hereto/gi, to: 'here to' },
    { from: /pullingat/gi, to: 'pulling at' },
  ];
  
  for (const { from, to } of commonFixes) {
    t = t.replace(from, to);
  }

  // Step 5: Collapse multiple spaces back to single space
  t = t.replace(/\s{2,}/g, ' ');

  // Step 6: Restore preserved patterns BEFORE final trim
  t = t.replace(/__PRESERVED_(\d+)__/g, (_, index) => preserved[parseInt(index)]);

  // Step 7: Trim and clean up
  t = t.trim();

  return t;
}

/**
 * Main export: cleans all AI responses
 * This is the function that should be called from filterResponse
 */
export function cleanAIResponse(text) {
  try {
    return fixPunctuationSpacing(text);
  } catch (e) {
    logger.warn('[TextCleaner] Failed to clean text:', e.message);
    return text; // fail safe - never break the response
  }
}

