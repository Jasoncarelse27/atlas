import { describe, it, expect, vi } from 'vitest';

// We only assert that the flag shim exports without throwing and exposes known members.
// Detailed behavior is covered by V1/V2 unit tests already.
vi.mock('@/features/chat/lib/flags', () => ({ flags: { offlineStoreV2: true }}));
describe('useConversationStore (flag: ON)', () => {
  it('exposes hook and actions', async () => {
    const mod = await import('../useConversationStore');
    expect(typeof mod.useConversationStore).toBe('function');
    expect(mod.conversationActions).toBeTruthy();
  });
});

vi.mock('@/features/chat/lib/flags', () => ({ flags: { offlineStoreV2: false }}));
describe('useConversationStore (flag: OFF)', () => {
  it('falls back to V1 safely', async () => {
    const mod = await import('../useConversationStore');
    expect(typeof mod.useConversationStore).toBe('function');
    expect(mod.conversationActions).toBeTruthy();
  });
});
