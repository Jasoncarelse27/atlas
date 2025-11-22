export function stableMessageSort(a: any, b: any) {
  // Primary: timestamp / created_at
  const aTime = a.timestamp
    ? new Date(a.timestamp).getTime()
    : a.created_at
    ? new Date(a.created_at).getTime()
    : 0;

  const bTime = b.timestamp
    ? new Date(b.timestamp).getTime()
    : b.created_at
    ? new Date(b.created_at).getTime()
    : 0;

  if (aTime !== bTime) return aTime - bTime;

  // Secondary: id fallback for stable ordering
  if (a.id && b.id) {
    return String(a.id).localeCompare(String(b.id));
  }

  return 0;
}

export function appendMessageSafely(prevMessages: any[], newMessage: any) {
  // Deduplicate by id
  if (prevMessages.some(msg => msg.id === newMessage.id)) {
    return prevMessages;
  }

  const merged = [...prevMessages, newMessage];
  return merged.sort(stableMessageSort);
}
