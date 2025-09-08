import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/lib/db/dexieClient'
import { conversationStoreV2 } from '@/features/chat/stores/conversationStoreV2'

const BASE = {
  conversationId: 'c1',
  role: 'user' as const,
}

beforeEach(async () => {
  await db.messages.clear()
})

it('persists pending message locally and confirms on successful send', async () => {
  const msg = { id: 'm1', ...BASE, content: 'hello', createdAt: Date.now() }
  await conversationStoreV2.addLocalPending(msg)
  let list = await conversationStoreV2.list('c1')
  expect(list.length).toBe(1)
  expect(list[0].pending).toBe(true)

  const send = vi.fn().mockResolvedValue({ ok: true, serverId: 'srv-1' })
  await conversationStoreV2.flush(send)
  list = await conversationStoreV2.list('c1')
  expect(list[0].pending).toBe(false)
  expect(list[0].error).toBeNull()
})

it('marks failed on send error and keeps for retry', async () => {
  const msg = { id: 'm2', ...BASE, content: 'oops', createdAt: Date.now() }
  await conversationStoreV2.addLocalPending(msg)
  const send = vi.fn().mockResolvedValue({ ok: false, error: 'NETWORK' })
  await conversationStoreV2.flush(send)
  const list = await conversationStoreV2.list('c1')
  expect(list[0].pending).toBe(true)
  expect(list[0].error).toBe('NETWORK')
})

it('syncs from server and removes pending flag', async () => {
  await conversationStoreV2.syncFromServer('c1', async () => ([
    { id: 's1', conversationId: 'c1', role: 'assistant', content: 'hi', createdAt: Date.now() }
  ]))
  const list = await conversationStoreV2.list('c1')
  expect(list.length).toBe(1)
  expect(list[0].pending).toBeFalsy()
})
