/**
 * Simple in-memory rate limiter
 * For production, consider Redis-based solution
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const requestCounts = new Map<string, RateLimitRecord>();

/**
 * Check if request is within rate limit
 *
 * @param key - Unique identifier (e.g., IP address)
 * @param limit - Max requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Get remaining requests for a key
 */
export function getRateLimitRemaining(key: string, limit: number): number {
  const record = requestCounts.get(key);
  if (!record) return limit;
  return Math.max(0, limit - record.count);
}

// Cleanup old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60000); // Every minute
