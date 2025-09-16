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
      console.error(`[Retry] Final attempt ${attempt} failed:`, err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`[Retry] Attempt ${attempt}/${attempt + retries} failed: ${errorMessage}. Retrying in ${delay}ms...`);
    
    await new Promise((res) => setTimeout(res, delay));
    return retry(fn, retries - 1, delay * 2, attempt + 1);
  }
}
