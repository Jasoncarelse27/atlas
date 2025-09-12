import { AppError, normalizeError } from "./error";

type HttpInit = RequestInit & { timeoutMs?: number };

export async function http<T = unknown>(url: string, init: HttpInit = {}): Promise<T> {
  const { timeoutMs = 20000, headers, ...rest } = init;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {})
      },
      signal: controller.signal
    });
    
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    
    if (!res.ok) {
      throw new AppError("UNKNOWN", (data as any)?.message || res.statusText, res.status, data);
    }
    
    return data as T;
  } catch (_e: unknown) {
    throw normalizeError(e);
  } finally {
    clearTimeout(t);
  }
}
