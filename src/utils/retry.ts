// src/utils/retry.ts
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  attempt = 1
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) {
      throw err;
    }
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    await new Promise((res) => setTimeout(res, delay));
    return retry(fn, retries - 1, delay * 2, attempt + 1);
  }
}
