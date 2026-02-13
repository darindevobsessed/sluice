import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRotatingMessages } from '../useRotatingMessages'

describe('useRotatingMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns first message initially', () => {
    const messages = ['Message 1', 'Message 2', 'Message 3']
    const { result } = renderHook(() => useRotatingMessages(messages))

    expect(result.current).toBe('Message 1')
  })

  it('cycles to next message after interval', async () => {
    vi.useFakeTimers()

    const messages = ['Message 1', 'Message 2', 'Message 3']
    const { result } = renderHook(() => useRotatingMessages(messages, 3000))

    expect(result.current).toBe('Message 1')

    // Advance time to trigger first rotation
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current).toBe('Message 2')

    // Advance time to trigger second rotation
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current).toBe('Message 3')
  })

  it('wraps around to first message after all messages shown', async () => {
    vi.useFakeTimers()

    const messages = ['Message 1', 'Message 2', 'Message 3']
    const { result } = renderHook(() => useRotatingMessages(messages, 3000))

    expect(result.current).toBe('Message 1')

    // Cycle through all messages
    await act(async () => {
      vi.advanceTimersByTime(3000) // -> Message 2
    })
    await act(async () => {
      vi.advanceTimersByTime(3000) // -> Message 3
    })
    await act(async () => {
      vi.advanceTimersByTime(3000) // -> Message 1 (wrap around)
    })

    expect(result.current).toBe('Message 1')
  })

  it('respects prefers-reduced-motion and stays on first message', async () => {
    vi.useFakeTimers()

    // Mock window.matchMedia to return prefers-reduced-motion: reduce
    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    vi.stubGlobal('matchMedia', matchMediaMock)

    const messages = ['Message 1', 'Message 2', 'Message 3']
    const { result } = renderHook(() => useRotatingMessages(messages, 3000))

    expect(result.current).toBe('Message 1')

    // Advance time - should NOT rotate
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current).toBe('Message 1')

    // Advance more time - still should NOT rotate
    await act(async () => {
      vi.advanceTimersByTime(6000)
    })

    expect(result.current).toBe('Message 1')

    vi.unstubAllGlobals()
  })

  it('cleans up timer on unmount', async () => {
    vi.useFakeTimers()

    const messages = ['Message 1', 'Message 2', 'Message 3']
    const { result, unmount } = renderHook(() =>
      useRotatingMessages(messages, 3000),
    )

    expect(result.current).toBe('Message 1')

    // Unmount immediately
    unmount()

    // Advance time - should NOT rotate after unmount
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    // Result should still be Message 1 (no rotation happened)
    expect(result.current).toBe('Message 1')
  })

  it('resets to first message when messages array changes', async () => {
    vi.useFakeTimers()

    const messages1 = ['Message 1', 'Message 2', 'Message 3']
    const messages2 = ['New 1', 'New 2', 'New 3']

    const { result, rerender } = renderHook(
      ({ msgs }) => useRotatingMessages(msgs, 3000),
      {
        initialProps: { msgs: messages1 },
      },
    )

    expect(result.current).toBe('Message 1')

    // Rotate to second message
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current).toBe('Message 2')

    // Change messages array
    rerender({ msgs: messages2 })

    // Should reset to first message of new array
    expect(result.current).toBe('New 1')
  })

  it('uses default interval of 3000ms when not provided', async () => {
    vi.useFakeTimers()

    const messages = ['Message 1', 'Message 2']
    const { result } = renderHook(() => useRotatingMessages(messages))

    expect(result.current).toBe('Message 1')

    // Advance by default interval (3000ms)
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current).toBe('Message 2')
  })

  it('handles custom interval correctly', async () => {
    vi.useFakeTimers()

    const messages = ['Message 1', 'Message 2']
    const { result } = renderHook(() => useRotatingMessages(messages, 1500))

    expect(result.current).toBe('Message 1')

    // Advance by custom interval (1500ms)
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current).toBe('Message 2')
  })

  it('handles single message array', async () => {
    vi.useFakeTimers()

    const messages = ['Only message']
    const { result } = renderHook(() => useRotatingMessages(messages, 3000))

    expect(result.current).toBe('Only message')

    // Advance time - should stay on same message
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current).toBe('Only message')
  })

  it('returns first message as fallback for empty index', () => {
    const messages = ['Fallback message']
    const { result } = renderHook(() => useRotatingMessages(messages))

    expect(result.current).toBe('Fallback message')
  })
})
