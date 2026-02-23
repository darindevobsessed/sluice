import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLastVisited } from '../useLastVisited'

const STORAGE_KEY = 'sluice-last-visited'

describe('useLastVisited', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('initializes with null when no previous visit', () => {
    const { result } = renderHook(() => useLastVisited())

    expect(result.current.lastVisitedAt).toBeNull()
    expect(typeof result.current.markVisited).toBe('function')
  })

  it('loads last visited timestamp from localStorage', () => {
    const timestamp = '2026-02-01T12:00:00.000Z'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamp))

    const { result } = renderHook(() => useLastVisited())

    expect(result.current.lastVisitedAt).toBe(timestamp)
  })

  it('handles invalid JSON in localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-json')

    const { result } = renderHook(() => useLastVisited())

    expect(result.current.lastVisitedAt).toBeNull()
  })

  it('handles malformed timestamp in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '"not-a-timestamp"')

    const { result } = renderHook(() => useLastVisited())

    expect(result.current.lastVisitedAt).toBeNull()
  })

  it('updates timestamp when markVisited is called', () => {
    const { result } = renderHook(() => useLastVisited())

    expect(result.current.lastVisitedAt).toBeNull()

    act(() => {
      result.current.markVisited()
    })

    expect(result.current.lastVisitedAt).not.toBeNull()
    expect(typeof result.current.lastVisitedAt).toBe('string')

    // Verify it's a valid ISO timestamp
    const parsed = new Date(result.current.lastVisitedAt!)
    expect(parsed.toISOString()).toBe(result.current.lastVisitedAt)
  })

  it('persists timestamp to localStorage', () => {
    const { result } = renderHook(() => useLastVisited())

    act(() => {
      result.current.markVisited()
    })

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).not.toBeNull()
    expect(stored).toBe(JSON.stringify(result.current.lastVisitedAt))
  })

  it('auto-marks visited on mount after delay', async () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useLastVisited())

    expect(result.current.lastVisitedAt).toBeNull()

    // Fast-forward past the delay (100ms)
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.lastVisitedAt).not.toBeNull()

    vi.useRealTimers()
  })

  it('does not auto-mark if already marked manually', async () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useLastVisited())

    // Manually mark visited
    act(() => {
      result.current.markVisited()
    })

    const manualTimestamp = result.current.lastVisitedAt

    // Fast-forward past the delay
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    // Timestamp should not have changed
    expect(result.current.lastVisitedAt).toBe(manualTimestamp)

    vi.useRealTimers()
  })

  it('cleans up timeout on unmount', async () => {
    vi.useFakeTimers()

    const { result, unmount } = renderHook(() => useLastVisited())

    expect(result.current.lastVisitedAt).toBeNull()

    // Unmount before the delay completes
    unmount()

    // Fast-forward past the delay
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    // Should not have marked visited
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    vi.useRealTimers()
  })

  it('survives localStorage quota exceeded error', () => {
    const { result } = renderHook(() => useLastVisited())

    // Mock localStorage.setItem to throw quota exceeded error
    const originalSetItem = localStorage.setItem
    localStorage.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })

    // Should not throw
    expect(() => {
      act(() => {
        result.current.markVisited()
      })
    }).not.toThrow()

    // State should still update
    expect(result.current.lastVisitedAt).not.toBeNull()

    // Restore
    localStorage.setItem = originalSetItem
  })
})
