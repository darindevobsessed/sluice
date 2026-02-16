/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRelatedChunks } from '../useRelatedChunks'

describe('useRelatedChunks', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches related chunks on mount', async () => {
    const mockRelated = [
      { id: 1, videoId: 2, similarity: 0.9 },
      { id: 2, videoId: 3, similarity: 0.8 },
    ]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ related: mockRelated }),
    })

    const { result } = renderHook(() => useRelatedChunks(1))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.related).toEqual(mockRelated)
    expect(result.current.error).toBeNull()
  })

  it('handles fetch errors', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
    })

    const { result } = renderHook(() => useRelatedChunks(1))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to fetch related chunks')
    expect(result.current.related).toEqual([])
  })

  it('aborts fetch when unmounted', async () => {
    const abortSpy = vi.fn()

    // Create a proper constructor mock
    const MockAbortController = vi.fn(function(this: any) {
      this.signal = { aborted: false }
      this.abort = abortSpy
    })

    vi.stubGlobal('AbortController', MockAbortController)

    ;(global.fetch as any).mockImplementation(() => new Promise(() => {})) // Never resolves

    const { unmount } = renderHook(() => useRelatedChunks(1))

    unmount()

    expect(abortSpy).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('does not update state after unmount', async () => {
    const mockRelated = [{ id: 1, videoId: 2, similarity: 0.9 }]

    let resolvePromise: (value: any) => void
    const fetchPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    ;(global.fetch as any).mockReturnValue(fetchPromise)

    const { result, unmount } = renderHook(() => useRelatedChunks(1))

    expect(result.current.isLoading).toBe(true)

    unmount()

    // Resolve the fetch after unmount
    resolvePromise!({
      ok: true,
      json: async () => ({ related: mockRelated }),
    })

    // Wait a bit to ensure no state updates happen
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Result should still show loading state from before unmount
    expect(result.current.isLoading).toBe(true)
  })

  it('ignores AbortError', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'

    ;(global.fetch as any).mockRejectedValueOnce(abortError)

    const { result } = renderHook(() => useRelatedChunks(1))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should not set error for AbortError
    expect(result.current.error).toBeNull()
    expect(result.current.related).toEqual([])
  })

  it('refetches when videoId changes', async () => {
    const mockRelated1 = [{ id: 1, videoId: 2, similarity: 0.9 }]
    const mockRelated2 = [{ id: 3, videoId: 4, similarity: 0.8 }]

    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ related: mockRelated1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ related: mockRelated2 }),
      })

    const { result, rerender } = renderHook(
      ({ videoId }) => useRelatedChunks(videoId),
      { initialProps: { videoId: 1 } }
    )

    await waitFor(() => {
      expect(result.current.related).toEqual(mockRelated1)
    })

    rerender({ videoId: 2 })

    await waitFor(() => {
      expect(result.current.related).toEqual(mockRelated2)
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
