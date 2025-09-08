import Dexie, { Table } from 'dexie'

export type CachedMessage = {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  pending?: boolean       // not yet confirmed by server
  error?: string | null   // last send error (for retry UI)
}

class AtlasDexie extends Dexie {
  messages!: Table<CachedMessage, string>
  constructor() {
    super('atlas-cache')
    this.version(1).stores({
      messages: 'id, conversationId, createdAt, pending'
    })
  }
}

export const db = new AtlasDexie()
