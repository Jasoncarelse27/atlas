export type AppErrorCode = "NETWORK"|"TIMEOUT"|"UNAUTHORIZED"|"FORBIDDEN"|"NOT_FOUND"|"RATE_LIMIT"|"SERVER"|"VALIDATION"|"UNKNOWN";

export class AppError extends Error {
  code: AppErrorCode;
  status?: number;
  details?: unknown;

  constructor(code: AppErrorCode, message: string, status?: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function normalizeError(_e: unknown) {
  if (e instanceof AppError) return e;
  
  if (e?.name === "AbortError") return new AppError("TIMEOUT", "Request timed out");
  
  const s = e?.status ?? e?.response?.status;
  if (s === 401) return new AppError("UNAUTHORIZED", "Please sign in", s);
  if (s === 403) return new AppError("FORBIDDEN", "No permission", s);
  if (s === 404) return new AppError("NOT_FOUND", "Not found", s);
  if (s === 429) return new AppError("RATE_LIMIT", "Too many requests", s);
  if (s >= 500) return new AppError("SERVER", "Server error", s);
  if (s >= 400) return new AppError("VALIDATION", "Request error", s, e?.response?.data);
  if (e?.message?.includes("Network")) return new AppError("NETWORK", "Network error");
  
  return new AppError("UNKNOWN", "Unexpected error", s, e);
}

export function userMessage(err: AppError) {
  switch (err.code) {
    case "UNAUTHORIZED": return "Session expired. Please log in.";
    case "FORBIDDEN": return "You don't have permission for that action.";
    case "NOT_FOUND": return "We couldn't find what you asked for.";
    case "RATE_LIMIT": return "Slow down a bit—try again shortly.";
    case "SERVER": return "Our server had a hiccup. Try again.";
    case "NETWORK": return "Check your internet connection.";
    case "TIMEOUT": return "This is taking too long. Try again.";
    case "VALIDATION": return "Please check your inputs and try again.";
    default: return "Something went wrong. Please try again.";
  }
}
