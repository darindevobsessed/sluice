/**
 * Tests for YouTube transcript API route
 * Following TDD: Tests written FIRST, implementation SECOND
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import * as transcriptLib from '@/lib/youtube/transcript';
import * as rateLimitLib from '@/lib/rate-limit';

// Mock dependencies
vi.mock('@/lib/youtube/transcript', () => ({
  fetchTranscript: vi.fn(),
  clearTranscriptCache: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitRemaining: vi.fn(),
}));

describe('POST /api/youtube/transcript', () => {
  const mockFetchTranscript = transcriptLib.fetchTranscript as ReturnType<typeof vi.fn>;
  const mockClearTranscriptCache = transcriptLib.clearTranscriptCache as ReturnType<typeof vi.fn>;
  const mockCheckRateLimit = rateLimitLib.checkRateLimit as ReturnType<typeof vi.fn>;
  const mockGetRateLimitRemaining = rateLimitLib.getRateLimitRemaining as ReturnType<typeof vi.fn>;

  // Helper to create mock Request
  function createRequest(body: unknown, headers: Record<string, string> = {}): Request {
    return {
      json: async () => body,
      headers: {
        get: (name: string) => headers[name.toLowerCase()] || null,
      },
    } as Request;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit allows request
    mockCheckRateLimit.mockReturnValue(true);
    mockGetRateLimitRemaining.mockReturnValue(10);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with transcript data on successful fetch', async () => {
    mockFetchTranscript.mockResolvedValue({
      success: true,
      transcript: '0:00\nHello world\n\n0:05\nThis is a test',
      segments: [
        { timestamp: '0:00', seconds: 0, text: 'Hello world' },
        { timestamp: '0:05', seconds: 5, text: 'This is a test' },
      ],
      language: 'en',
      fromCache: false,
    });

    const request = createRequest({ videoId: 'dQw4w9WgXcQ' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      transcript: '0:00\nHello world\n\n0:05\nThis is a test',
      segments: [
        { timestamp: '0:00', seconds: 0, text: 'Hello world' },
        { timestamp: '0:05', seconds: 5, text: 'This is a test' },
      ],
      language: 'en',
      fromCache: false,
    });
  });

  it('returns 400 for invalid videoId (empty string)', async () => {
    const request = createRequest({ videoId: '' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid video ID');
    expect(mockFetchTranscript).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid videoId (too long)', async () => {
    const request = createRequest({ videoId: 'a'.repeat(21) }); // Max is 20
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid video ID');
  });

  it('returns 400 for missing videoId', async () => {
    const request = createRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid video ID');
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockCheckRateLimit.mockReturnValue(false);
    mockGetRateLimitRemaining.mockReturnValue(0);

    const request = createRequest(
      { videoId: 'dQw4w9WgXcQ' },
      { 'x-forwarded-for': '192.168.1.1' }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data).toEqual({
      success: false,
      error: 'Too many requests. Please wait a moment before trying again.',
      rateLimited: true,
    });
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(mockFetchTranscript).not.toHaveBeenCalled();
  });

  it('uses client IP from x-forwarded-for header for rate limiting', async () => {
    mockFetchTranscript.mockResolvedValue({
      success: true,
      transcript: 'test',
      segments: [],
      language: 'en',
    });

    const request = createRequest(
      { videoId: 'abc123' },
      { 'x-forwarded-for': '203.0.113.42, 198.51.100.1' } // Multiple IPs
    );
    await POST(request);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'transcript:203.0.113.42',
      10,
      60000
    );
  });

  it('uses x-real-ip header as fallback for rate limiting', async () => {
    mockFetchTranscript.mockResolvedValue({
      success: true,
      transcript: 'test',
      segments: [],
      language: 'en',
    });

    const request = createRequest(
      { videoId: 'abc123' },
      { 'x-real-ip': '198.51.100.5' }
    );
    await POST(request);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'transcript:198.51.100.5',
      10,
      60000
    );
  });

  it('uses "unknown" as fallback when no IP headers present', async () => {
    mockFetchTranscript.mockResolvedValue({
      success: true,
      transcript: 'test',
      segments: [],
      language: 'en',
    });

    const request = createRequest({ videoId: 'abc123' });
    await POST(request);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'transcript:unknown',
      10,
      60000
    );
  });

  it('clears cache when forceRefresh is true', async () => {
    mockFetchTranscript.mockResolvedValue({
      success: true,
      transcript: 'refreshed',
      segments: [],
      language: 'en',
    });

    const request = createRequest({ videoId: 'abc123', forceRefresh: true });
    await POST(request);

    expect(mockClearTranscriptCache).toHaveBeenCalledWith('abc123');
    expect(mockFetchTranscript).toHaveBeenCalledWith('abc123');
  });

  it('does not clear cache when forceRefresh is false', async () => {
    mockFetchTranscript.mockResolvedValue({
      success: true,
      transcript: 'cached',
      segments: [],
      language: 'en',
    });

    const request = createRequest({ videoId: 'abc123', forceRefresh: false });
    await POST(request);

    expect(mockClearTranscriptCache).not.toHaveBeenCalled();
    expect(mockFetchTranscript).toHaveBeenCalledWith('abc123');
  });

  it('does not clear cache when forceRefresh is omitted', async () => {
    mockFetchTranscript.mockResolvedValue({
      success: true,
      transcript: 'cached',
      segments: [],
      language: 'en',
    });

    const request = createRequest({ videoId: 'abc123' });
    await POST(request);

    expect(mockClearTranscriptCache).not.toHaveBeenCalled();
  });

  it('returns fallbackToManual flag when transcript fetch fails', async () => {
    mockFetchTranscript.mockResolvedValue({
      success: false,
      transcript: null,
      segments: [],
      error: 'Transcripts are disabled for this video',
    });

    const request = createRequest({ videoId: 'abc123' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: false,
      error: 'Transcripts are disabled for this video',
      fallbackToManual: true,
    });
  });

  it('returns 200 with fallbackToManual for malformed JSON body', async () => {
    const request = {
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
      headers: {
        get: () => null,
      },
    } as unknown as Request;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch transcript');
    expect(data.fallbackToManual).toBe(true);
  });

  it('includes rate limit headers in rate-limited response', async () => {
    mockCheckRateLimit.mockReturnValue(false);
    mockGetRateLimitRemaining.mockReturnValue(0);

    const request = createRequest({ videoId: 'abc123' });
    const response = await POST(request);

    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('handles non-Error exceptions gracefully', async () => {
    mockFetchTranscript.mockRejectedValue('String error');

    const request = createRequest({ videoId: 'abc123' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: false,
      error: 'Failed to fetch transcript',
      fallbackToManual: true,
    });
  });

  it('accepts valid videoId at minimum length', async () => {
    mockFetchTranscript.mockResolvedValue({
      success: true,
      transcript: 'test',
      segments: [],
      language: 'en',
    });

    const request = createRequest({ videoId: 'a' }); // Min length is 1
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockFetchTranscript).toHaveBeenCalledWith('a');
  });

  it('accepts valid videoId at maximum length', async () => {
    mockFetchTranscript.mockResolvedValue({
      success: true,
      transcript: 'test',
      segments: [],
      language: 'en',
    });

    const videoId = 'a'.repeat(20); // Max length is 20
    const request = createRequest({ videoId });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockFetchTranscript).toHaveBeenCalledWith(videoId);
  });
});
