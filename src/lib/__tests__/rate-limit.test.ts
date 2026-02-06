import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkRateLimit, getRateLimitRemaining } from '../rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows first request', () => {
    const allowed = checkRateLimit('user1', 5, 60000);
    expect(allowed).toBe(true);
  });

  it('allows requests within limit', () => {
    const key = 'user2';
    const limit = 5;
    const windowMs = 60000;

    // First 5 requests should be allowed
    for (let i = 0; i < limit; i++) {
      expect(checkRateLimit(key, limit, windowMs)).toBe(true);
    }
  });

  it('blocks requests over limit', () => {
    const key = 'user3';
    const limit = 3;
    const windowMs = 60000;

    // First 3 requests allowed
    for (let i = 0; i < limit; i++) {
      expect(checkRateLimit(key, limit, windowMs)).toBe(true);
    }

    // 4th request should be blocked
    expect(checkRateLimit(key, limit, windowMs)).toBe(false);
    expect(checkRateLimit(key, limit, windowMs)).toBe(false);
  });

  it('resets after window expires', () => {
    const key = 'user4';
    const limit = 3;
    const windowMs = 60000;

    // Use up the limit
    for (let i = 0; i < limit; i++) {
      checkRateLimit(key, limit, windowMs);
    }

    // Should be blocked
    expect(checkRateLimit(key, limit, windowMs)).toBe(false);

    // Advance time past window
    vi.advanceTimersByTime(windowMs + 1000);

    // Should be allowed again
    expect(checkRateLimit(key, limit, windowMs)).toBe(true);
  });

  it('handles different keys independently', () => {
    const limit = 2;
    const windowMs = 60000;

    // user5 uses their limit
    expect(checkRateLimit('user5', limit, windowMs)).toBe(true);
    expect(checkRateLimit('user5', limit, windowMs)).toBe(true);
    expect(checkRateLimit('user5', limit, windowMs)).toBe(false);

    // user6 should have their own limit
    expect(checkRateLimit('user6', limit, windowMs)).toBe(true);
    expect(checkRateLimit('user6', limit, windowMs)).toBe(true);
    expect(checkRateLimit('user6', limit, windowMs)).toBe(false);
  });
});

describe('getRateLimitRemaining', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns full limit for new key', () => {
    const remaining = getRateLimitRemaining('newuser', 10);
    expect(remaining).toBe(10);
  });

  it('returns accurate remaining count', () => {
    const key = 'user7';
    const limit = 5;
    const windowMs = 60000;

    // Initially full
    expect(getRateLimitRemaining(key, limit)).toBe(5);

    // After 1 request
    checkRateLimit(key, limit, windowMs);
    expect(getRateLimitRemaining(key, limit)).toBe(4);

    // After 3 requests
    checkRateLimit(key, limit, windowMs);
    checkRateLimit(key, limit, windowMs);
    expect(getRateLimitRemaining(key, limit)).toBe(2);

    // After limit reached
    checkRateLimit(key, limit, windowMs);
    checkRateLimit(key, limit, windowMs);
    expect(getRateLimitRemaining(key, limit)).toBe(0);
  });

  it('never returns negative values', () => {
    const key = 'user8';
    const limit = 2;
    const windowMs = 60000;

    // Use up limit and try more
    checkRateLimit(key, limit, windowMs);
    checkRateLimit(key, limit, windowMs);
    checkRateLimit(key, limit, windowMs); // Blocked
    checkRateLimit(key, limit, windowMs); // Blocked

    expect(getRateLimitRemaining(key, limit)).toBe(0);
  });
});
