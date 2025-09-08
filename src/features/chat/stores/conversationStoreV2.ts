import { db, CachedMessage } from '@/lib/db/dexieClient'
import { OfflineQueue } from '@/lib/offline/offlineQueue'

export type SendFn = (msg: Omit<CachedMessage, 'pending'|'error'>) => Promise<{ ok: boolean; serverId?: string; error?: string }>
export type ListFn = (conversationId: string) => Promise<Array<Omit<CachedMessage, 'pending'|'error'>>>

export class ConversationStoreV2 {
  private resend = new OfflineQueue<CachedMessage>()

  async list(conversationId: string) {
    return db.messages.where('conversationId').equals(conversationId).sortBy('createdAt')
  }

  async addLocalPending(m: CachedMessage) {
    await db.messages.put({ ...m, pending: true, error: null })
    this.resend.enqueue({ key: m.id, payload: m })
  }

  async markConfirmed(id: string) {
    await db.messages.update(id, { pending: false, error: null })
  }

  async markFailed(id: string, reason: string) {
    await db.messages.update(id, { pending: true, error: reason })
  }

  async syncFromServer(conversationId: string, fetchList: ListFn) {
    const server = await fetchList(conversationId)
    // naive merge: upsert everything from server (local pending kept)
    await db.transaction('rw', db.messages, async () => {
      for (const s of server) {
        await db.messages.put({
          ...s,
          pending: false,
          error: null,
          createdAt: s.createdAt ?? Date.now(),
        })
      }
    })
  }

  async flush(send: SendFn) {
    await this.resend.flush(async (item) => {
      const { payload } = item
      const { ok, serverId, error } = await send(payload)
      if (ok) await this.markConfirmed(payload.id)
      else await this.markFailed(payload.id, error ?? 'SEND_FAILED')
      // optional: map client id -> server id if different
      if (ok && serverId && serverId !== payload.id) {
        await db.messages.update(payload.id, { id: serverId })
      }
    })
  }
}

export const conversationStoreV2 = new ConversationStoreV2()
