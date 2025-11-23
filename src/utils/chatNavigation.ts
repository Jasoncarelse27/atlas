import { atlasDB } from '../database/atlasDB';

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

    // 3. Final fallback
    navigate('/chat');
  } catch (err) {
    console.warn("[ChatNav] Failed to restore last conversation:", err);
    navigate('/chat');
  }
}

