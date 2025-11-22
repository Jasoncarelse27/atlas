import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

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
 * Search messages and conversation titles across all user conversations
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

    // Build Supabase query - search in both message content and conversation titles
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
      .or(`content.ilike.%${searchTerm}%,conversations.title.ilike.%${searchTerm}%`) // Search in both content and title
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
    // ✅ TYPE SAFETY: Properly type the joined conversations data
    const results: SearchResult[] = data.map((msg: any) => {
      const content = msg.content || '';
      
      // ✅ TYPE SAFETY: Handle conversations join result (can be object or array)
      const conversationTitle = 
        (msg.conversations && typeof msg.conversations === 'object' && !Array.isArray(msg.conversations))
          ? msg.conversations.title 
          : Array.isArray(msg.conversations) && msg.conversations[0]
            ? msg.conversations[0].title
            : 'Untitled Conversation';
      
      // Create snippet from content, but if the match is in the title, show that too
      let snippet = createSnippet(content, searchTerm);
      
      // If the search term matches the conversation title, include it in the snippet
      if (conversationTitle.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !content.toLowerCase().includes(searchTerm.toLowerCase())) {
        snippet = `In conversation "${highlightSearchTerm(conversationTitle, searchTerm)}": ${snippet}`;
      }

      return {
        messageId: msg.id,
        conversationId: msg.conversation_id,
        conversationTitle: conversationTitle,
        content: content,
        timestamp: msg.created_at,
        role: msg.role as 'user' | 'assistant' | 'system',
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
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight search term in text (for UI rendering)
 * ✅ SECURITY: Escapes HTML to prevent XSS attacks
 */
export function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!searchTerm || !text) return text;

  // ✅ SECURITY: Escape HTML first to prevent XSS
  const escapedText = escapeHtml(text);
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
  return escapedText.replace(regex, '<mark class="bg-yellow-200 text-gray-900 px-0.5 rounded">$1</mark>');
}

/**
 * Search conversations by title
 * Useful for quick conversation lookup
 */
export async function searchConversationsByTitle(
  userId: string,
  query: string
): Promise<{ id: string; title: string; lastMessageAt: string }[]> {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = query.trim();
    logger.debug('[SearchService] Searching conversations by title:', searchTerm);

    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .ilike('title', `%${searchTerm}%`)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) {
      logger.error('[SearchService] Conversation search failed:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      logger.debug('[SearchService] No conversations found');
      return [];
    }

    return data.map(conv => ({
      id: conv.id,
      title: conv.title || 'Untitled Conversation',
      lastMessageAt: conv.updated_at
    }));
  } catch (error) {
    logger.error('[SearchService] Conversation search error:', error);
    return [];
  }
}

