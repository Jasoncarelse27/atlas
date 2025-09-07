import { useRef } from 'react';
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

type StartStreamArgs = {
  conversationId: string;
  userText: string;
  onToken: (t: string) => void;
  onDone?: () => void;
  onError?: (e: unknown) => void;
};

/**
 * Stream assistant tokens from your API (Server-Sent Events or "text/event-stream").
 * Endpoint is taken from EXPO_PUBLIC_API_BASE; adjust path if needed.
 * Call startStream({ ... }) to begin; you'll get token callbacks in real time.
 */
export function useMessageStream() {
  const abortRef = useRef<AbortController | null>(null);

  async function startStream({ conversationId, userText, onToken, onDone, onError }: StartStreamArgs) {
    try {
      // cancel any in-flight stream
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const base = process.env.EXPO_PUBLIC_API_BASE?.replace(/\/+$/, '') ?? '';
      const url = `${base}/chat/stream`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ conversationId, message: userText }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Stream HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      const parser = createParser((evt: ParsedEvent | ReconnectInterval) => {
        if (typeof evt === 'object' && evt.type === 'event') {
          if (evt.event === 'done') {
            onDone?.();
            abortRef.current?.abort();
            abortRef.current = null;
            return;
          }
          try {
            const data = evt.data ?? '';
            if (data) onToken(data);
          } catch (e) {
            // ignore token parse errors
          }
        }
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }

      onDone?.();
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') onError?.(e);
    } finally {
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  return { startStream, stop };
}
