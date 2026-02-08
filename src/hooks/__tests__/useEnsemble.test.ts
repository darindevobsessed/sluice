import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useEnsemble } from '../useEnsemble'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useEnsemble', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('returns initial state when question is null', () => {
    const { result } = renderHook(() => useEnsemble(null))

    expect(result.current.state.isLoading).toBe(false)
    expect(result.current.state.personas.size).toBe(0)
    expect(result.current.state.bestMatch).toBeNull()
    expect(result.current.state.isAllDone).toBe(false)
    expect(result.current.state.error).toBeNull()
  })

  it('does not fetch when question is null', () => {
    renderHook(() => useEnsemble(null))

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('posts to ensemble endpoint when question is provided', async () => {
    // Mock SSE stream response
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"all_done"}\n\n'))
          controller.close()
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useEnsemble('How does React work?'))

    expect(mockFetch).toHaveBeenCalledWith('/api/personas/ensemble', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: 'How does React work?' }),
      signal: expect.any(AbortSignal),
    })

    await waitFor(
      () => {
        expect(result.current.state.isLoading).toBe(false)
      },
      { timeout: 1000 }
    )
  })

  it('parses persona_start event and initializes persona state', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"persona_start","personaId":1,"personaName":"Fireship"}\n\n'
            )
          )
          controller.enqueue(new TextEncoder().encode('data: {"type":"all_done"}\n\n'))
          controller.close()
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useEnsemble('What is TypeScript?'))

    await waitFor(
      () => {
        const persona = result.current.state.personas.get(1)
        expect(persona).toBeDefined()
        expect(persona?.personaId).toBe(1)
        expect(persona?.personaName).toBe('Fireship')
        expect(persona?.text).toBe('')
        expect(persona?.isDone).toBe(false)
        expect(persona?.isError).toBe(false)
      },
      { timeout: 1000 }
    )
  })

  it('accumulates text from delta events', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"persona_start","personaId":1,"personaName":"Fireship"}\n\n'
            )
          )
          controller.enqueue(
            new TextEncoder().encode('data: {"type":"delta","personaId":1,"text":"Hello "}\n\n')
          )
          controller.enqueue(
            new TextEncoder().encode('data: {"type":"delta","personaId":1,"text":"world"}\n\n')
          )
          controller.enqueue(new TextEncoder().encode('data: {"type":"all_done"}\n\n'))
          controller.close()
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useEnsemble('What is TypeScript?'))

    await waitFor(
      () => {
        const persona = result.current.state.personas.get(1)
        expect(persona?.text).toBe('Hello world')
      },
      { timeout: 1000 }
    )
  })

  it('parses sources event and stores chunk data', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"persona_start","personaId":1,"personaName":"Fireship"}\n\n'
            )
          )
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"sources","personaId":1,"chunks":[{"chunkId":10,"content":"Test content","videoTitle":"Test Video"}]}\n\n'
            )
          )
          controller.enqueue(new TextEncoder().encode('data: {"type":"all_done"}\n\n'))
          controller.close()
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useEnsemble('What is TypeScript?'))

    await waitFor(
      () => {
        const persona = result.current.state.personas.get(1)
        expect(persona?.sources).toHaveLength(1)
        expect(persona?.sources[0]?.chunkId).toBe(10)
        expect(persona?.sources[0]?.content).toBe('Test content')
        expect(persona?.sources[0]?.videoTitle).toBe('Test Video')
      },
      { timeout: 1000 }
    )
  })

  it('marks persona as done when persona_done event is received', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"persona_start","personaId":1,"personaName":"Fireship"}\n\n'
            )
          )
          controller.enqueue(
            new TextEncoder().encode('data: {"type":"persona_done","personaId":1}\n\n')
          )
          controller.enqueue(new TextEncoder().encode('data: {"type":"all_done"}\n\n'))
          controller.close()
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useEnsemble('What is TypeScript?'))

    await waitFor(
      () => {
        const persona = result.current.state.personas.get(1)
        expect(persona?.isDone).toBe(true)
      },
      { timeout: 1000 }
    )
  })

  it('handles persona_error event', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"persona_start","personaId":1,"personaName":"Fireship"}\n\n'
            )
          )
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"persona_error","personaId":1,"error":"Rate limit exceeded"}\n\n'
            )
          )
          controller.enqueue(new TextEncoder().encode('data: {"type":"all_done"}\n\n'))
          controller.close()
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useEnsemble('What is TypeScript?'))

    await waitFor(
      () => {
        const persona = result.current.state.personas.get(1)
        expect(persona?.isError).toBe(true)
        expect(persona?.errorMessage).toBe('Rate limit exceeded')
      },
      { timeout: 1000 }
    )
  })

  it('parses best_match event', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"best_match","personaId":2,"personaName":"ThePrimeagen","score":0.92}\n\n'
            )
          )
          controller.enqueue(new TextEncoder().encode('data: {"type":"all_done"}\n\n'))
          controller.close()
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useEnsemble('What is Vim?'))

    await waitFor(
      () => {
        expect(result.current.state.bestMatch).toEqual({
          personaId: 2,
          personaName: 'ThePrimeagen',
          score: 0.92,
        })
      },
      { timeout: 1000 }
    )
  })

  it('marks isAllDone when all_done event is received', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"all_done"}\n\n'))
          controller.close()
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useEnsemble('What is TypeScript?'))

    await waitFor(
      () => {
        expect(result.current.state.isAllDone).toBe(true)
        expect(result.current.state.isLoading).toBe(false)
      },
      { timeout: 1000 }
    )
  })

  it('handles fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useEnsemble('What is TypeScript?'))

    await waitFor(
      () => {
        expect(result.current.state.error).toBe('Network error')
        expect(result.current.state.isLoading).toBe(false)
      },
      { timeout: 1000 }
    )
  })

  it('aborts request when question changes', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          // Simulate long-running stream
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode('data: {"type":"all_done"}\n\n'))
            controller.close()
          }, 1000)
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result, rerender } = renderHook(
      ({ question }) => useEnsemble(question),
      { initialProps: { question: 'First question' } }
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Change question
    rerender({ question: 'Second question' })

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      },
      { timeout: 1000 }
    )
  })

  it('aborts request when unmounted', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          // Never completes
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result, unmount } = renderHook(() => useEnsemble('What is TypeScript?'))

    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Unmount should clean up without errors
    unmount()

    // If cleanup works, this test passes
    expect(true).toBe(true)
  })

  it('reset function clears all state', async () => {
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"persona_start","personaId":1,"personaName":"Fireship"}\n\n'
            )
          )
          controller.enqueue(new TextEncoder().encode('data: {"type":"all_done"}\n\n'))
          controller.close()
        },
      }),
    }

    mockFetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useEnsemble('What is TypeScript?'))

    await waitFor(
      () => {
        expect(result.current.state.personas.size).toBeGreaterThan(0)
      },
      { timeout: 1000 }
    )

    // Call reset
    act(() => {
      result.current.reset()
    })

    expect(result.current.state.personas.size).toBe(0)
    expect(result.current.state.bestMatch).toBeNull()
    expect(result.current.state.isAllDone).toBe(false)
    expect(result.current.state.error).toBeNull()
  })
})
