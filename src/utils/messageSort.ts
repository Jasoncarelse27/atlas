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
  return String(a.id).localeCompare(String(b.id));
}

export function appendMessageSafely(prev: any[], incoming: any) {
  // Deduplicate by id
  if (prev.some(msg => msg.id === incoming.id)) {
    return prev;
  }
  return [...prev, incoming].sort(stableMessageSort);
}
