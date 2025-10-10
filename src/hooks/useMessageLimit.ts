import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useMessageLimit as useTierMessageLimit } from './useTierAccess';

export function useMessageLimit(conversationId: string, userId?: string) {
  const { tier, getLimit, isUnlimited } = useTierMessageLimit();
  const [count, setCount] = useState(0);
  const [blocked, setBlocked] = useState(false);

  const messageLimit = getLimit('textMessages') || 15;

  useEffect(() => {
    async function fetchMessageCount() {
      if (!userId || !conversationId) return;

      try {
        const { count: messageCount, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conversationId)
          .eq('user_id', userId);

        if (error) {
          const localCount = parseInt(localStorage.getItem(`msg_count_${conversationId}`) || '0');
          setCount(localCount);
        } else {
          setCount(messageCount || 0);
        }

        if (!isUnlimited('textMessages') && (messageCount || 0) >= messageLimit) {
          setBlocked(true);
        }
      } catch (error) {
        const localCount = parseInt(localStorage.getItem(`msg_count_${conversationId}`) || '0');
        setCount(localCount);
        
        if (!isUnlimited('textMessages') && localCount >= messageLimit) {
          setBlocked(true);
        }
      }
    }

    fetchMessageCount();
  }, [tier, conversationId, userId, messageLimit, isUnlimited]);

  function increment() {
    const next = count + 1;
    setCount(next);

    localStorage.setItem(`msg_count_${conversationId}`, String(next));
    
    if (!isUnlimited('textMessages') && next >= messageLimit) {
      setBlocked(true);
    }
  }

  function getRemainingMessages() {
    if (isUnlimited('textMessages')) return 'Unlimited';
    return Math.max(0, messageLimit - count);
  }

  return { 
    count, 
    blocked, 
    increment, 
    messageLimit,
    remaining: getRemainingMessages(),
    isUnlimited: isUnlimited('textMessages')
  };
}
