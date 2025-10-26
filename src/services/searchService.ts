import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

export interface SearchResult {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  content: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  snippet: string; // Highlighted excerpt
}

/**
 * Search messages across all user conversations
 * Uses Supabase ILIKE for case-insensitive pattern matching
 * Filters out deleted messages automatically
 */
export async function searchMessages(
  userId: string,
  query: string,
  conversationId?: string
): Promise<SearchResult[]> {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = query.trim();
    logger.debug('[SearchService] Searching for:', searchTerm);

    // Build Supabase query
    let supabaseQuery = supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        content,
        created_at,
        role,
        conversations!inner (
          title
        )
      `)
      .eq('user_id', userId)
      .is('deleted_at', null) // Filter out deleted messages
      .ilike('content', `%${searchTerm}%`) // Case-insensitive search
      .order('created_at', { ascending: false })
      .limit(50);

    // Optional: Filter by specific conversation
    if (conversationId) {
      supabaseQuery = supabaseQuery.eq('conversation_id', conversationId);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      logger.error('[SearchService] Search failed:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      logger.debug('[SearchService] No results found');
      return [];
    }

    // Format results with snippets
    const results: SearchResult[] = data.map((msg: { id: string; content?: string; conversation_id: string; created_at: string; role: string }) => {
      const content = msg.content || '';
      const snippet = createSnippet(content, searchTerm);

      return {
        messageId: msg.id,
        conversationId: msg.conversation_id,
        conversationTitle: msg.conversations?.title || 'Untitled Conversation',
        content: content,
        timestamp: msg.created_at,
        role: msg.role,
        snippet,
      };
    });

    logger.debug(`[SearchService] Found ${results.length} results`);
    return results;
  } catch (error) {
    logger.error('[SearchService] Search error:', error);
    return [];
  }
}

/**
 * Create a highlighted snippet around the search term
 * Shows ~100 characters around the match
 */
function createSnippet(content: string, searchTerm: string, contextLength: number = 100): string {
  const lowerContent = content.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const index = lowerContent.indexOf(lowerTerm);

  if (index === -1) {
    // Fallback: just return first 150 chars
    return content.substring(0, 150) + (content.length > 150 ? '...' : '');
  }

  // Calculate snippet bounds
  const start = Math.max(0, index - contextLength / 2);
  const end = Math.min(content.length, index + searchTerm.length + contextLength / 2);

  let snippet = content.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Highlight search term in text (for UI rendering)
 */
export function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!searchTerm || !text) return text;

  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 text-gray-900 px-0.5 rounded">$1</mark>');
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

