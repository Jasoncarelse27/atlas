type MessageEvent = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  record: { id: string; conversation_id: string; role: 'user'|'assistant'|'system'; content: string; created_at?: string }
}

export type RealtimeUnsubscribe = () => void

/**
 * We keep this adapter tiny and dependency-free. In app runtime, you can
 * import the real supabase client and pass it here; in tests we mock it.
 */
export function subscribeToMessages(opts: {
  _supabase: any
  conversationId: string
  onMessage: (evt: MessageEvent) => void
}): RealtimeUnsubscribe {
  const { supabase, conversationId, onMessage } = opts
  const channel = supabase?.channel?.(`messages:${conversationId}`)
    ?.on?.('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, onMessage)
    ?.subscribe?.()
  return () => { 
    try { 
      channel?.unsubscribe?.() 
    } catch (error) {
      logger.warn('Failed to unsubscribe from realtime channel:', error);
    }
  }
}
