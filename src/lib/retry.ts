export const retryDelaysMs = (retries: number, base = 500) =>
  Array.from({ length: retries }, (_, i) => Math.min(8000, base * 2 ** i));
