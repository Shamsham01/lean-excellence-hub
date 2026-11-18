/**
 * Small in-memory fixed-window rate limiter.
 *
 * Best effort: each server instance keeps its own window, so this blunts
 * bursts and scripted resubmits without needing a shared store. The webhook
 * side (Make.com) stays the system of record.
 */
export type RateLimiter = {
  hit(key: string, now?: number): boolean;
  reset(): void;
};

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 5_000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    /** Returns true when the request is allowed. */
    hit(key, now = Date.now()) {
      const current = windows.get(key);
      if (!current || now - current.start >= windowMs) {
        if (windows.size >= maxKeys) {
          for (const [k, w] of windows) {
            if (now - w.start >= windowMs) windows.delete(k);
          }
          if (windows.size >= maxKeys) {
            const oldest = windows.keys().next().value;
            if (oldest !== undefined) windows.delete(oldest);
          }
        }
        windows.set(key, { start: now, count: 1 });
        return true;
      }
      current.count += 1;
      return current.count <= limit;
    },
    reset() {
      windows.clear();
    },
  };
}

/** Shared by `/api/early-access`: 8 requests per client per 10 minutes. */
export const earlyAccessRateLimiter = createRateLimiter({
  limit: 8,
  windowMs: 10 * 60 * 1000,
});
