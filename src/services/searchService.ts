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

    // ✅ FIX: PostgREST doesn't support nested relations in `or` clause
    // Split into two queries: messages by content + conversations by title
    
    // Step 1: Search messages by content (original working query)
    let messagesQuery = supabase
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
      .is('deleted_at', null)
      .ilike('content', `%${searchTerm}%`) // ✅ FIX: Search content only
      .order('created_at', { ascending: false })
      .limit(50);

    // Optional: Filter by specific conversation
    if (conversationId) {
      messagesQuery = messagesQuery.eq('conversation_id', conversationId);
    }

    const { data: messagesData, error: messagesError } = await messagesQuery;

    if (messagesError) {
      logger.error('[SearchService] Messages search failed:', messagesError);
      throw messagesError;
    }

    // Step 2: Search conversations by title, then get messages from those conversations
    const { data: conversationsData, error: conversationsError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .ilike('title', `%${searchTerm}%`)
      .limit(20);

    let conversationMessagesData: any[] = [];
    
    if (!conversationsError && conversationsData && conversationsData.length > 0) {
      // Get messages from conversations that match the title
      const matchingConversationIds = conversationsData.map(c => c.id);
      
      let conversationMessagesQuery = supabase
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
        .is('deleted_at', null)
        .in('conversation_id', matchingConversationIds)
        .order('created_at', { ascending: false })
        .limit(50);

      // Optional: Filter by specific conversation
      if (conversationId) {
        conversationMessagesQuery = conversationMessagesQuery.eq('conversation_id', conversationId);
      }

      const { data: convMessagesData, error: convMessagesError } = await conversationMessagesQuery;
      
      if (!convMessagesError && convMessagesData) {
        conversationMessagesData = convMessagesData;
      } else if (convMessagesError) {
        logger.warn('[SearchService] Conversation messages search failed:', convMessagesError);
        // Don't throw - continue with content-only results
      }
    }

    // Combine and deduplicate results by message ID
    const allMessages = [...(messagesData || []), ...conversationMessagesData];
    const uniqueMessages = new Map<string, any>();
    
    for (const msg of allMessages) {
      if (!uniqueMessages.has(msg.id)) {
        uniqueMessages.set(msg.id, msg);
      }
    }

    // Sort by created_at descending and limit to 50 total results
    const data = Array.from(uniqueMessages.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

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

