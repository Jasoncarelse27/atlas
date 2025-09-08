import { describe, it, expect } from 'vitest';
import { messagesService } from '@/services/messagesService';

describe('messagesService', () => {
  it('lists and sends messages (MSW)', async () => {
    const id = 'conv-1';
    const before = await messagesService.list(id);
    expect(Array.isArray(before)).toBe(true);
    
    // The messagesService returns the response directly from http<Message>
    // But MSW returns { success: true, message: msg }, so we get that structure
    const response = await messagesService.send(id, 'hello');
    expect(response.success).toBe(true);
    expect(response.message.content).toBe('hello');
    expect(response.message.role).toBe('user');
    
    const after = await messagesService.list(id);
    expect(after.length).toBe(before.length + 1);
  });
});
