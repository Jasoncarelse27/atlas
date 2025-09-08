import { describe, it, expect, vi } from 'vitest'
import { OfflineQueue } from '@/lib/offline/offlineQueue'

describe('OfflineQueue', () => {
  it('enqueues and flushes items', async () => {
    const q = new OfflineQueue<{ x: number }>()
    q.enqueue({ key: 'a', payload: { x: 1 } })
    q.enqueue({ key: 'b', payload: { x: 2 } })
    const sender = vi.fn().mockResolvedValue(undefined)
    await q.flush(sender)
    expect(sender).toHaveBeenCalledTimes(2)
    expect(q.size()).toBe(0)
  })
})
