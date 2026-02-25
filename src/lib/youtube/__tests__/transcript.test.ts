import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchTranscript, clearTranscriptCache } from '../transcript'

// Mock both transcript libraries
vi.mock('youtube-caption-extractor', () => ({
  getSubtitles: vi.fn(),
}))

vi.mock('@danielxceron/youtube-transcript', () => ({
  YoutubeTranscript: {
    fetchTranscript: vi.fn(),
  },
}))

import { getSubtitles } from 'youtube-caption-extractor'
import { YoutubeTranscript } from '@danielxceron/youtube-transcript'

const mockGetSubtitles = vi.mocked(getSubtitles)
const mockFetchTranscript = vi.mocked(YoutubeTranscript.fetchTranscript)

describe('fetchTranscript', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns transcript data on success via primary extractor', async () => {
    mockGetSubtitles.mockResolvedValueOnce([
      { text: 'Hello world', start: '0', dur: '2' },
      { text: 'This is a test', start: '2', dur: '3' },
      { text: 'Great video', start: '5', dur: '2' },
    ])

    const result = await fetchTranscript('test-video-id')

    expect(result.success).toBe(true)
    expect(result.transcript).toContain('0:00\nHello world')
    expect(result.transcript).toContain('0:02\nThis is a test')
    expect(result.transcript).toContain('0:05\nGreat video')
    expect(result.segments).toHaveLength(3)
    expect(result.segments[0]).toEqual({
      timestamp: '0:00',
      seconds: 0,
      text: 'Hello world',
    })
    expect(result.language).toBe('en')
    expect(result.error).toBeUndefined()
    expect(mockFetchTranscript).not.toHaveBeenCalled()
  })

  it('falls back to library when primary fails', async () => {
    mockGetSubtitles.mockRejectedValueOnce(new Error('blocked'))
    mockFetchTranscript.mockResolvedValueOnce([
      { text: 'Fallback content', offset: 0, duration: 2 },
    ])

    const result = await fetchTranscript('fallback-video')

    expect(result.success).toBe(true)
    expect(result.transcript).toContain('0:00\nFallback content')
    expect(mockGetSubtitles).toHaveBeenCalledTimes(1)
    expect(mockFetchTranscript).toHaveBeenCalledTimes(1)
  })

  it('formats timestamps correctly for hours', async () => {
    mockGetSubtitles.mockResolvedValueOnce([
      { text: 'Start', start: '0', dur: '1' },
      { text: 'One hour mark', start: '3600', dur: '1' },
      { text: 'Hour and half', start: '5445', dur: '1' },
    ])

    const result = await fetchTranscript('long-video')

    expect(result.success).toBe(true)
    expect(result.segments[0]?.timestamp).toBe('0:00')
    expect(result.segments[1]?.timestamp).toBe('1:00:00')
    expect(result.segments[2]?.timestamp).toBe('1:30:45')
  })

  it('handles error when no transcript available from fallback', async () => {
    mockGetSubtitles.mockRejectedValueOnce(new Error('blocked'))
    mockFetchTranscript.mockResolvedValueOnce([])

    const result = await fetchTranscript('no-transcript-video')

    expect(result.success).toBe(false)
    expect(result.transcript).toBeNull()
    expect(result.segments).toEqual([])
    expect(result.error).toBe('No transcript available for this video')
  })

  it('handles both extractors failing', async () => {
    mockGetSubtitles.mockRejectedValueOnce(new Error('blocked'))
    mockFetchTranscript.mockRejectedValueOnce(
      new Error('Transcript is disabled on this video')
    )

    const result = await fetchTranscript('disabled-video')

    expect(result.success).toBe(false)
    expect(result.transcript).toBeNull()
    expect(result.error).toBe('Transcripts are disabled for this video')
  })

  it('handles private/unavailable videos', async () => {
    mockGetSubtitles.mockRejectedValueOnce(new Error('blocked'))
    mockFetchTranscript.mockRejectedValueOnce(new Error('Video is private'))

    const result = await fetchTranscript('private-video')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Video is private or unavailable')
  })

  it('handles unknown errors gracefully', async () => {
    mockGetSubtitles.mockRejectedValueOnce(new Error('Network timeout'))
    mockFetchTranscript.mockRejectedValueOnce(new Error('Network timeout'))

    const result = await fetchTranscript('error-video')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to fetch transcript')
    expect(result.error).toContain('Network timeout')
  })

  it('caches successful results', async () => {
    mockGetSubtitles.mockResolvedValueOnce([
      { text: 'Cached content', start: '0', dur: '1' },
    ])

    // First call
    const result1 = await fetchTranscript('cached-video')
    expect(result1.success).toBe(true)
    expect(result1.fromCache).toBeUndefined()
    expect(mockGetSubtitles).toHaveBeenCalledTimes(1)

    // Second call should use cache
    const result2 = await fetchTranscript('cached-video')
    expect(result2.success).toBe(true)
    expect(result2.fromCache).toBe(true)
    expect(mockGetSubtitles).toHaveBeenCalledTimes(1) // Not called again
  })

  it('caches failures briefly', async () => {
    mockGetSubtitles.mockRejectedValueOnce(new Error('blocked'))
    mockFetchTranscript.mockRejectedValueOnce(
      new Error('Transcript is disabled on this video')
    )

    // First call
    const result1 = await fetchTranscript('failed-video')
    expect(result1.success).toBe(false)
    expect(mockGetSubtitles).toHaveBeenCalledTimes(1)

    // Second call should use cached failure
    const result2 = await fetchTranscript('failed-video')
    expect(result2.success).toBe(false)
    expect(result2.fromCache).toBe(true)
    expect(mockGetSubtitles).toHaveBeenCalledTimes(1) // Not called again
  })

  it('cache expires after TTL', async () => {
    mockGetSubtitles
      .mockResolvedValueOnce([{ text: 'First fetch', start: '0', dur: '1' }])
      .mockResolvedValueOnce([{ text: 'Second fetch', start: '0', dur: '1' }])

    // First call
    await fetchTranscript('expire-video')
    expect(mockGetSubtitles).toHaveBeenCalledTimes(1)

    // Before expiry, should use cache
    vi.advanceTimersByTime(4 * 60 * 1000) // 4 minutes
    await fetchTranscript('expire-video')
    expect(mockGetSubtitles).toHaveBeenCalledTimes(1)

    // After expiry, should fetch again
    vi.advanceTimersByTime(2 * 60 * 1000) // 2 more minutes (total 6)
    const result = await fetchTranscript('expire-video')
    expect(mockGetSubtitles).toHaveBeenCalledTimes(2)
    expect(result.transcript).toContain('Second fetch')
  })

  it('trims whitespace from text segments', async () => {
    mockGetSubtitles.mockResolvedValueOnce([
      { text: '  Hello world  ', start: '0', dur: '1' },
      { text: '\n\nTest\n\n', start: '1', dur: '1' },
    ])

    const result = await fetchTranscript('whitespace-video')

    expect(result.success).toBe(true)
    expect(result.segments[0]?.text).toBe('Hello world')
    expect(result.segments[1]?.text).toBe('Test')
  })
})

describe('clearTranscriptCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clears cache for specific video', async () => {
    mockGetSubtitles
      .mockResolvedValueOnce([{ text: 'Original', start: '0', dur: '1' }])
      .mockResolvedValueOnce([{ text: 'After clear', start: '0', dur: '1' }])

    // First fetch and cache
    await fetchTranscript('clear-test-video')
    expect(mockGetSubtitles).toHaveBeenCalledTimes(1)

    // Verify cached
    await fetchTranscript('clear-test-video')
    expect(mockGetSubtitles).toHaveBeenCalledTimes(1) // Still 1

    // Clear cache
    clearTranscriptCache('clear-test-video')

    // Next fetch should call API again
    const result = await fetchTranscript('clear-test-video')
    expect(mockGetSubtitles).toHaveBeenCalledTimes(2)
    expect(result.transcript).toContain('After clear')
  })

  it('only clears specified video cache', async () => {
    mockGetSubtitles
      .mockResolvedValueOnce([{ text: 'Video 1', start: '0', dur: '1' }])
      .mockResolvedValueOnce([{ text: 'Video 2', start: '0', dur: '1' }])

    // Cache two videos
    await fetchTranscript('video1')
    await fetchTranscript('video2')
    expect(mockGetSubtitles).toHaveBeenCalledTimes(2)

    // Clear only video1
    clearTranscriptCache('video1')

    // video2 should still be cached
    await fetchTranscript('video2')
    expect(mockGetSubtitles).toHaveBeenCalledTimes(2) // Not called again

    // video1 should fetch again
    mockGetSubtitles.mockResolvedValueOnce([
      { text: 'Video 1 new', start: '0', dur: '1' },
    ])
    await fetchTranscript('video1')
    expect(mockGetSubtitles).toHaveBeenCalledTimes(3)
  })
})
