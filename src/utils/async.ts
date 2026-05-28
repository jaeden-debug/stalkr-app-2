/**
 * Safe async wrapper — prevents uncaught rejections and logs errors
 */
export function safeAsync<T>(
  fn: () => Promise<T>,
  context?: string,
): Promise<T | null> {
  return fn().catch((error) => {
    const tag = context ? `[${context}]` : '[safeAsync]';
    console.error(tag, error);
    return null;
  });
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limitMs: number,
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= limitMs) {
      lastRun = now;
      fn(...args);
    }
  };
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
      }
    }
  }
  throw lastError;
}

/**
 * UUID v4 validator
 */
export function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
