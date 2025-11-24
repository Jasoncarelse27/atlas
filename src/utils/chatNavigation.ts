import { atlasDB } from '../database/atlasDB';
import { supabase } from '../lib/supabaseClient';

export async function navigateToLastConversation(navigate: any) {
  try {
    // 1. Fastest path: localStorage
    const lastId = localStorage.getItem("atlas:lastConversationId");
    if (lastId) {
      navigate(`/chat?conversation=${lastId}`);
      return;
    }

    // 2. Dexie fallback
    const row = await atlasDB.appState.get("lastOpenedConversationId");
    if (row?.value) {
      navigate(`/chat?conversation=${row.value}`);
      return;
    }

    // 3. Supabase fallback: Check profiles.last_conversation_id
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // No user authenticated → safe fallback to new chat
        console.log("[Nav][SECURITY] Fallback triggered: No authenticated user");
        navigate('/chat');
        return;
      }

      // ✅ PERFORMANCE: Parallelize both Supabase queries (saves 500ms-2s)
      const [profileRes, recentConvRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('last_conversation_id')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('conversations')
          .select('id')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      const profile = profileRes?.data ?? null;
      const recentConv = recentConvRes?.data ?? null;

      // Priority: profiles.last_conversation_id first, then most recent conversation
      const lastConversationId = profile?.last_conversation_id ?? recentConv?.id ?? null;

      if (lastConversationId) {
        console.log("[Nav][SECURITY] Fallback triggered:", {
          userId: user.id,
          from: "localStorage+Dexie",
          usedProfileFallback: !!profile?.last_conversation_id,
          usedRecentFallback: !!recentConv?.id,
          finalConversationId: lastConversationId
        });
        navigate(`/chat?conversation=${lastConversationId}`);
        return;
      }

      // 5. Only if ALL checks fail → create new conversation
      console.log("[Nav][SECURITY] Fallback triggered:", {
        userId: user.id,
        from: "localStorage+Dexie+Supabase",
        usedProfileFallback: false,
        usedRecentFallback: false,
        finalConversationId: "new"
      });
      navigate('/chat');
    } catch (supabaseErr) {
      // Supabase query failed → safe fallback to new chat
      console.warn("[ChatNav] Supabase fallback failed:", supabaseErr);
      navigate('/chat');
    }
  } catch (err) {
    console.warn("[ChatNav] Failed to restore last conversation:", err);
    navigate('/chat');
  }
}

