import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fetchTranscript, clearTranscriptCache } from '../transcript';

// Mock the @danielxceron/youtube-transcript package
vi.mock('@danielxceron/youtube-transcript', () => ({
  YoutubeTranscript: {
    fetchTranscript: vi.fn(),
  },
}));

import { YoutubeTranscript } from '@danielxceron/youtube-transcript';

const mockFetchTranscript = vi.mocked(YoutubeTranscript.fetchTranscript);

describe('fetchTranscript', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns transcript data on success', async () => {
    // Mock successful response
    mockFetchTranscript.mockResolvedValueOnce([
      { text: 'Hello world', offset: 0, duration: 2 },
      { text: 'This is a test', offset: 2, duration: 3 },
      { text: 'Great video', offset: 5, duration: 2 },
    ]);

    const result = await fetchTranscript('test-video-id');

    expect(result.success).toBe(true);
    expect(result.transcript).toContain('0:00\nHello world');
    expect(result.transcript).toContain('0:02\nThis is a test');
    expect(result.transcript).toContain('0:05\nGreat video');
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]).toEqual({
      timestamp: '0:00',
      seconds: 0,
      text: 'Hello world',
    });
    expect(result.segments[1]).toEqual({
      timestamp: '0:02',
      seconds: 2,
      text: 'This is a test',
    });
    expect(result.language).toBe('en');
    expect(result.error).toBeUndefined();
  });

  it('formats timestamps correctly for hours', async () => {
    mockFetchTranscript.mockResolvedValueOnce([
      { text: 'Start', offset: 0, duration: 1 },
      { text: 'One hour mark', offset: 3600, duration: 1 },
      { text: 'Hour and half', offset: 5445, duration: 1 },
    ]);

    const result = await fetchTranscript('long-video');

    expect(result.success).toBe(true);
    expect(result.segments[0]?.timestamp).toBe('0:00');
    expect(result.segments[1]?.timestamp).toBe('1:00:00');
    expect(result.segments[2]?.timestamp).toBe('1:30:45');
  });

  it('handles error when no transcript available', async () => {
    mockFetchTranscript.mockResolvedValueOnce([]);

    const result = await fetchTranscript('no-transcript-video');

    expect(result.success).toBe(false);
    expect(result.transcript).toBeNull();
    expect(result.segments).toEqual([]);
    expect(result.error).toBe('No transcript available for this video');
  });

  it('handles disabled transcripts', async () => {
    mockFetchTranscript.mockRejectedValueOnce(
      new Error('Transcript is disabled on this video')
    );

    const result = await fetchTranscript('disabled-video');

    expect(result.success).toBe(false);
    expect(result.transcript).toBeNull();
    expect(result.error).toBe('Transcripts are disabled for this video');
  });

  it('handles private/unavailable videos', async () => {
    mockFetchTranscript.mockRejectedValueOnce(new Error('Video is private'));

    const result = await fetchTranscript('private-video');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Video is private or unavailable');
  });

  it('handles not found errors', async () => {
    mockFetchTranscript.mockRejectedValueOnce(
      new Error('Could not find video: not found')
    );

    const result = await fetchTranscript('not-found-video');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No transcript available for this video');
  });

  it('handles unknown errors gracefully', async () => {
    mockFetchTranscript.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await fetchTranscript('error-video');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch transcript');
    expect(result.error).toContain('Network timeout');
  });

  it('caches successful results', async () => {
    mockFetchTranscript.mockResolvedValueOnce([
      { text: 'Cached content', offset: 0, duration: 1 },
    ]);

    // First call
    const result1 = await fetchTranscript('cached-video');
    expect(result1.success).toBe(true);
    expect(result1.fromCache).toBeUndefined();
    expect(mockFetchTranscript).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const result2 = await fetchTranscript('cached-video');
    expect(result2.success).toBe(true);
    expect(result2.fromCache).toBe(true);
    expect(mockFetchTranscript).toHaveBeenCalledTimes(1); // Not called again
  });

  it('caches failures briefly', async () => {
    mockFetchTranscript.mockRejectedValueOnce(
      new Error('Transcript is disabled on this video')
    );

    // First call
    const result1 = await fetchTranscript('failed-video');
    expect(result1.success).toBe(false);
    expect(mockFetchTranscript).toHaveBeenCalledTimes(1);

    // Second call should use cached failure
    const result2 = await fetchTranscript('failed-video');
    expect(result2.success).toBe(false);
    expect(result2.fromCache).toBe(true);
    expect(mockFetchTranscript).toHaveBeenCalledTimes(1); // Not called again
  });

  it('cache expires after TTL', async () => {
    mockFetchTranscript
      .mockResolvedValueOnce([
        { text: 'First fetch', offset: 0, duration: 1 },
      ])
      .mockResolvedValueOnce([
        { text: 'Second fetch', offset: 0, duration: 1 },
      ]);

    // First call
    await fetchTranscript('expire-video');
    expect(mockFetchTranscript).toHaveBeenCalledTimes(1);

    // Before expiry, should use cache
    vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
    await fetchTranscript('expire-video');
    expect(mockFetchTranscript).toHaveBeenCalledTimes(1);

    // After expiry, should fetch again
    vi.advanceTimersByTime(2 * 60 * 1000); // 2 more minutes (total 6)
    const result = await fetchTranscript('expire-video');
    expect(mockFetchTranscript).toHaveBeenCalledTimes(2);
    expect(result.transcript).toContain('Second fetch');
  });

  it('trims whitespace from text segments', async () => {
    mockFetchTranscript.mockResolvedValueOnce([
      { text: '  Hello world  ', offset: 0, duration: 1 },
      { text: '\n\nTest\n\n', offset: 1, duration: 1 },
    ]);

    const result = await fetchTranscript('whitespace-video');

    expect(result.success).toBe(true);
    expect(result.segments[0]?.text).toBe('Hello world');
    expect(result.segments[1]?.text).toBe('Test');
  });
});

describe('clearTranscriptCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears cache for specific video', async () => {
    mockFetchTranscript
      .mockResolvedValueOnce([
        { text: 'Original', offset: 0, duration: 1 },
      ])
      .mockResolvedValueOnce([
        { text: 'After clear', offset: 0, duration: 1 },
      ]);

    // First fetch and cache
    await fetchTranscript('clear-test-video');
    expect(mockFetchTranscript).toHaveBeenCalledTimes(1);

    // Verify cached
    await fetchTranscript('clear-test-video');
    expect(mockFetchTranscript).toHaveBeenCalledTimes(1); // Still 1

    // Clear cache
    clearTranscriptCache('clear-test-video');

    // Next fetch should call API again
    const result = await fetchTranscript('clear-test-video');
    expect(mockFetchTranscript).toHaveBeenCalledTimes(2);
    expect(result.transcript).toContain('After clear');
  });

  it('only clears specified video cache', async () => {
    mockFetchTranscript
      .mockResolvedValueOnce([{ text: 'Video 1', offset: 0, duration: 1 }])
      .mockResolvedValueOnce([{ text: 'Video 2', offset: 0, duration: 1 }]);

    // Cache two videos
    await fetchTranscript('video1');
    await fetchTranscript('video2');
    expect(mockFetchTranscript).toHaveBeenCalledTimes(2);

    // Clear only video1
    clearTranscriptCache('video1');

    // video2 should still be cached
    await fetchTranscript('video2');
    expect(mockFetchTranscript).toHaveBeenCalledTimes(2); // Not called again

    // video1 should fetch again
    mockFetchTranscript.mockResolvedValueOnce([
      { text: 'Video 1 new', offset: 0, duration: 1 },
    ]);
    await fetchTranscript('video1');
    expect(mockFetchTranscript).toHaveBeenCalledTimes(3);
  });
});
