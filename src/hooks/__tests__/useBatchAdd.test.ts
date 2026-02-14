import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBatchAdd } from '../useBatchAdd'
import type { DiscoveryVideo } from '@/components/discovery/DiscoveryVideoCard'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useBatchAdd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockVideo = (youtubeId: string): DiscoveryVideo => ({
    youtubeId,
    title: `Video ${youtubeId}`,
    channelId: 'channel1',
    channelName: 'Test Channel',
    publishedAt: '2024-01-01T00:00:00Z',
    description: 'Test description',
    inBank: false,
  })

  describe('initial state', () => {
    it('starts with empty status map and not running', () => {
      const { result } = renderHook(() => useBatchAdd({ onComplete: vi.fn() }))

      expect(result.current.batchStatus.size).toBe(0)
      expect(result.current.isRunning).toBe(false)
      expect(result.current.results).toEqual({ success: 0, failed: 0 })
    })
  })

  describe('startBatch', () => {
    it('processes a single video successfully', async () => {
      const onComplete = vi.fn()
      const video = createMockVideo('video1')

      // Mock transcript API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, transcript: 'Test transcript' }),
      })

      // Mock video save API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 1 }),
      })

      const { result } = renderHook(() => useBatchAdd({ onComplete }))

      result.current.startBatch([video])

      // Wait for completion by checking the item status
      await waitFor(() => {
        const item = result.current.batchStatus.get('video1')
        expect(item?.status).toBe('done')
      })

      // Should no longer be running
      expect(result.current.isRunning).toBe(false)

      // Should call onComplete
      expect(onComplete).toHaveBeenCalledTimes(1)
      expect(result.current.results).toEqual({ success: 1, failed: 0 })
    })

    it('processes max 2 videos concurrently', async () => {
      const onComplete = vi.fn()
      const videos = [
        createMockVideo('video1'),
        createMockVideo('video2'),
        createMockVideo('video3'),
      ]

      let video1TranscriptStarted = false
      let video2TranscriptStarted = false
      let video3TranscriptStarted = false
      let resolveVideo1Transcript: (() => void) | null = null
      let resolveVideo2Transcript: (() => void) | null = null

      // Track when each video starts processing with controlled delays
      mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
        if (url.includes('/transcript')) {
          const body = JSON.parse((options?.body as string) || '{}')

          if (body.videoId === 'video1') {
            video1TranscriptStarted = true
            // Block until we explicitly resolve
            await new Promise<void>(resolve => { resolveVideo1Transcript = resolve })
            return {
              ok: true,
              json: async () => ({ success: true, transcript: 'Test transcript 1' }),
            }
          }

          if (body.videoId === 'video2') {
            video2TranscriptStarted = true
            // Block until we explicitly resolve
            await new Promise<void>(resolve => { resolveVideo2Transcript = resolve })
            return {
              ok: true,
              json: async () => ({ success: true, transcript: 'Test transcript 2' }),
            }
          }

          if (body.videoId === 'video3') {
            video3TranscriptStarted = true
            return {
              ok: true,
              json: async () => ({ success: true, transcript: 'Test transcript 3' }),
            }
          }
        }

        // Video save - instant
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: 1 }),
        }
      })

      const { result } = renderHook(() => useBatchAdd({ onComplete }))

      result.current.startBatch(videos)

      // Wait for first 2 to start
      await waitFor(() => {
        expect(video1TranscriptStarted).toBe(true)
        expect(video2TranscriptStarted).toBe(true)
      })

      // Third should not have started yet (concurrency limit = 2)
      expect(video3TranscriptStarted).toBe(false)

      // Complete video1 to free up a slot
      resolveVideo1Transcript!()

      // Wait for video3 to start
      await waitFor(() => {
        expect(video3TranscriptStarted).toBe(true)
      })

      // Complete video2
      resolveVideo2Transcript!()

      // Wait for all to complete
      await waitFor(() => {
        expect(result.current.isRunning).toBe(false)
      }, { timeout: 3000 })

      expect(result.current.results.success).toBe(3)
    })

    it('handles 429 rate limit with retry', async () => {
      const onComplete = vi.fn()
      const video = createMockVideo('video1')

      // First call: 429 with Retry-After
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '1' }),
      })

      // Second call (retry): success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, transcript: 'Test transcript' }),
      })

      // Video save
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 1 }),
      })

      const { result } = renderHook(() => useBatchAdd({ onComplete }))

      result.current.startBatch([video])

      // Should eventually succeed after retry
      await waitFor(() => {
        const item = result.current.batchStatus.get('video1')
        expect(item?.status).toBe('done')
      }, { timeout: 3000 })

      expect(result.current.results).toEqual({ success: 1, failed: 0 })
    })

    it('handles 409 duplicate as success', async () => {
      const onComplete = vi.fn()
      const video = createMockVideo('video1')

      // Mock transcript API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, transcript: 'Test transcript' }),
      })

      // Mock video save API with 409
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Duplicate video' }),
      })

      const { result } = renderHook(() => useBatchAdd({ onComplete }))

      result.current.startBatch([video])

      // Should mark as done despite 409
      await waitFor(() => {
        const item = result.current.batchStatus.get('video1')
        expect(item?.status).toBe('done')
      })

      expect(result.current.results).toEqual({ success: 1, failed: 0 })
    })

    it('handles transcript fetch failure', async () => {
      const onComplete = vi.fn()
      const video = createMockVideo('video1')

      // Mock transcript API failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'Failed to fetch transcript' }),
      })

      const { result } = renderHook(() => useBatchAdd({ onComplete }))

      result.current.startBatch([video])

      // Should mark as error
      await waitFor(() => {
        const item = result.current.batchStatus.get('video1')
        expect(item?.status).toBe('error')
        expect(item?.error).toBe('Failed to fetch transcript')
      })

      expect(result.current.results).toEqual({ success: 0, failed: 1 })
    })

    it('handles video save failure', async () => {
      const onComplete = vi.fn()
      const video = createMockVideo('video1')

      // Mock transcript API success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, transcript: 'Test transcript' }),
      })

      // Mock video save API failure (not 409)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })

      const { result } = renderHook(() => useBatchAdd({ onComplete }))

      result.current.startBatch([video])

      // Should mark as error
      await waitFor(() => {
        const item = result.current.batchStatus.get('video1')
        expect(item?.status).toBe('error')
        expect(item?.error).toBe('Internal server error')
      })

      expect(result.current.results).toEqual({ success: 0, failed: 1 })
    })

    it('calls onComplete after all items finish', async () => {
      const onComplete = vi.fn()
      const videos = [
        createMockVideo('video1'),
        createMockVideo('video2'),
      ]

      // Mock successful responses for both
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, transcript: 'Transcript 1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ id: 1 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, transcript: 'Transcript 2' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ id: 2 }),
        })

      const { result } = renderHook(() => useBatchAdd({ onComplete }))

      result.current.startBatch(videos)

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false)
      })

      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('calls transcript API with correct payload', async () => {
      const onComplete = vi.fn()
      const video = createMockVideo('video123')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, transcript: 'Test transcript' }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 1 }),
      })

      const { result } = renderHook(() => useBatchAdd({ onComplete }))

      result.current.startBatch([video])

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false)
      })

      // Check first call was to transcript API
      const firstCall = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(firstCall[0]).toBe('/api/youtube/transcript')
      expect(firstCall[1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = JSON.parse(firstCall[1].body as string)
      expect(body).toEqual({ videoId: 'video123' })
    })

    it('calls video save API with correct payload', async () => {
      const onComplete = vi.fn()
      const video = createMockVideo('video123')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, transcript: 'Test transcript' }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 1 }),
      })

      const { result } = renderHook(() => useBatchAdd({ onComplete }))

      result.current.startBatch([video])

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false)
      })

      // Check second call was to videos API
      const secondCall = mockFetch.mock.calls[1] as [string, RequestInit]
      expect(secondCall[0]).toBe('/api/videos')
      expect(secondCall[1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = JSON.parse(secondCall[1].body as string)
      expect(body).toEqual({
        youtubeId: 'video123',
        title: 'Video video123',
        channel: 'Test Channel',
        thumbnail: 'https://i.ytimg.com/vi/video123/mqdefault.jpg',
        transcript: 'Test transcript',
        sourceType: 'youtube',
      })
    })

    it('handles empty array gracefully', async () => {
      const onComplete = vi.fn()

      const { result } = renderHook(() => useBatchAdd({ onComplete }))

      result.current.startBatch([])

      // Should immediately call onComplete
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1)
      })

      expect(result.current.isRunning).toBe(false)
      expect(result.current.results).toEqual({ success: 0, failed: 0 })
    })
  })
})
