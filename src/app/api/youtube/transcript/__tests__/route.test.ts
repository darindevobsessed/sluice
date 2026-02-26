/**
 * Tests for YouTube transcript API route
 * Following TDD: Tests written FIRST, implementation SECOND
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import * as transcriptLib from '@/lib/youtube/transcript';

vi.mock('@/lib/auth-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-guards')>()
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(null),
  }
})

// Mock dependencies
vi.mock('@/lib/youtube/transcript', () => ({
  fetchTranscript: vi.fn(),
  clearTranscriptCache: vi.fn(),
}));

describe('POST /api/youtube/transcript', () => {
  const mockFetchTranscript = transcriptLib.fetchTranscript as ReturnType<typeof vi.fn>;
  const mockClearTranscriptCache = transcriptLib.clearTranscriptCache as ReturnType<typeof vi.fn>;

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
