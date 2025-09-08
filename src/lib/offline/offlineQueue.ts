/**
 * Very small in-memory queue used to retry pending/failed sends.
 * It is intentionally simple; store durability is handled by Dexie rows flagged as `pending`.
 */
export type QueueItem<T> = { key: string; payload: T }
type Sender<T> = (item: QueueItem<T>) => Promise<void>

export class OfflineQueue<T> {
  private q: QueueItem<T>[] = []
  enqueue(item: QueueItem<T>) { this.q.push(item) }
  size() { return this.q.length }
  async flush(sender: Sender<T>) {
    const copy = [...this.q]
    this.q = []
    for (const item of copy) {
      try { await sender(item) } catch { /* leave to caller to re-enqueue */ }
    }
  }
}
