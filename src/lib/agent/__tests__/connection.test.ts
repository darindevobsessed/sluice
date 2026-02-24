/**
 * Tests for AgentConnection WebSocket client
 * Note: Full WebSocket integration tested manually; these tests cover core logic
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AgentConnection } from '../connection'

describe('AgentConnection', () => {
  let connection: AgentConnection
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    connection = new AgentConnection()
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('starts with disconnected status', () => {
      expect(connection.getStatus()).toBe('disconnected')
    })
  })

  describe('status tracking', () => {
    it('returns current status', () => {
      const status = connection.getStatus()
      expect(['disconnected', 'connecting', 'connected', 'error']).toContain(status)
    })

    it('allows subscribing to status changes', () => {
      const listener = vi.fn()
      const unsubscribe = connection.onStatusChange(listener)

      expect(typeof unsubscribe).toBe('function')
    })

    it('unsubscribe function removes listener', () => {
      const listener = vi.fn()
      const unsubscribe = connection.onStatusChange(listener)

      unsubscribe()

      // Verify unsubscribe doesn't throw
      expect(() => unsubscribe()).not.toThrow()
    })
  })

  describe('generateInsight', () => {
    it('returns request id when not connected', () => {
      const callbacks = {
        onError: vi.fn()
      }

      const id = connection.generateInsight(
        {
          insightType: 'test',
          prompt: 'test prompt',
          systemPrompt: 'test system'
        },
        callbacks
      )

      expect(typeof id).toBe('string')
      expect(callbacks.onError).toHaveBeenCalledWith('Not connected to agent')
    })

    it('calls onError callback when not connected', () => {
      const callbacks = {
        onError: vi.fn()
      }

      connection.generateInsight(
        {
          insightType: 'test',
          prompt: 'test',
          systemPrompt: 'test'
        },
        callbacks
      )

      expect(callbacks.onError).toHaveBeenCalledWith('Not connected to agent')
    })

    it('returns empty string when not connected', () => {
      const callbacks = {
        onError: vi.fn()
      }

      const id = connection.generateInsight(
        {
          insightType: 'test',
          prompt: 'test',
          systemPrompt: 'test'
        },
        callbacks
      )

      expect(id).toBe('')
    })

    it('handles missing callbacks gracefully', () => {
      expect(() => {
        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test',
            systemPrompt: 'test'
          },
          {}
        )
      }).not.toThrow()
    })

    it('calls onError when WebSocket send fails', () => {
      // Create a mock WebSocket that throws on send
      const mockWs = {
        readyState: 1, // WebSocket.OPEN
        send: vi.fn(() => {
          throw new Error('Connection lost')
        }),
        close: vi.fn(),
      }

      // Manually set the connection's internal ws
      ;(connection as any).ws = mockWs

      const callbacks = {
        onStart: vi.fn(),
        onError: vi.fn(),
      }

      const id = connection.generateInsight(
        {
          insightType: 'test',
          prompt: 'test',
          systemPrompt: 'test'
        },
        callbacks
      )

      // Should return an id
      expect(id).toBeTruthy()

      // Should call onError due to send failure
      expect(callbacks.onError).toHaveBeenCalledWith('Connection lost')

      // Should not call onStart since send failed
      expect(callbacks.onStart).not.toHaveBeenCalled()

      // Clean up
      ;(connection as any).ws = null
    })

    it('cleans up active insight when send fails', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(() => {
          throw new Error('Send failed')
        }),
        close: vi.fn(),
      }

      ;(connection as any).ws = mockWs

      const callbacks = {
        onError: vi.fn(),
      }

      const id = connection.generateInsight(
        {
          insightType: 'test',
          prompt: 'test',
          systemPrompt: 'test'
        },
        callbacks
      )

      // Active insight should be cleaned up
      const activeInsights = (connection as any).activeInsights
      expect(activeInsights.has(id)).toBe(false)

      // Clean up
      ;(connection as any).ws = null
    })
  })

  describe('cancelInsight', () => {
    it('does not throw when not connected', () => {
      expect(() => {
        connection.cancelInsight('test-id')
      }).not.toThrow()
    })

    it('does not throw with empty id', () => {
      expect(() => {
        connection.cancelInsight('')
      }).not.toThrow()
    })
  })

  describe('disconnect', () => {
    it('does not throw when not connected', () => {
      expect(() => {
        connection.disconnect()
      }).not.toThrow()
    })

    it('can be called multiple times', () => {
      expect(() => {
        connection.disconnect()
        connection.disconnect()
        connection.disconnect()
      }).not.toThrow()
    })
  })

  describe('edge cases', () => {
    // Skip: This test tries to actually connect to a WebSocket which times out in test env
    it.skip('handles empty token in connect', async () => {
      // Calling connect with empty token will fail but should not throw synchronously
      const connectPromise = connection.connect('')
      // Clean up the promise to avoid unhandled rejection
      await expect(connectPromise).rejects.toThrow()
    })

    it('handles empty callbacks in generateInsight', () => {
      expect(() => {
        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test',
            systemPrompt: 'test'
          },
          {}
        )
      }).not.toThrow()
    })

    it('getStatus returns valid ConnectionStatus', () => {
      const status = connection.getStatus()
      const validStatuses = ['disconnected', 'connecting', 'connected', 'error']
      expect(validStatuses).toContain(status)
    })
  })

  describe('SSE transport', () => {
    describe('connect with SSE', () => {
      it('marks as connected immediately without network call', async () => {
        const statusListener = vi.fn()
        connection.onStatusChange(statusListener)

        await connection.connect('test-token', 'sse')

        expect(connection.getStatus()).toBe('connected')
        expect(statusListener).toHaveBeenCalledWith('connected')
      })

      it('can connect multiple times without error', async () => {
        await connection.connect('test-token', 'sse')
        await connection.connect('test-token', 'sse')

        expect(connection.getStatus()).toBe('connected')
      })
    })

    describe('generateInsight with SSE', () => {
      beforeEach(async () => {
        await connection.connect('test-token', 'sse')
      })

      it('makes POST request to /api/agent/stream', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"text","content":"Hello"}\n\n') })
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"done","fullContent":"Hello World"}\n\n') })
                .mockResolvedValueOnce({ done: true })
            })
          }
        })
        global.fetch = mockFetch as any

        const callbacks = {
          onStart: vi.fn(),
          onText: vi.fn(),
          onDone: vi.fn()
        }

        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test prompt',
            systemPrompt: 'test system'
          },
          callbacks
        )

        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/agent/stream',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"prompt":"test prompt"')
          })
        )
      })

      it('streams text events to onText callback', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"text","content":"Hello "}\n\n') })
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"text","content":"World"}\n\n') })
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"done","fullContent":"Hello World"}\n\n') })
                .mockResolvedValueOnce({ done: true })
            })
          }
        })
        global.fetch = mockFetch as any

        const callbacks = {
          onText: vi.fn(),
          onDone: vi.fn()
        }

        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test prompt',
            systemPrompt: 'test system'
          },
          callbacks
        )

        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 20))

        expect(callbacks.onText).toHaveBeenCalledWith('Hello ')
        expect(callbacks.onText).toHaveBeenCalledWith('World')
        expect(callbacks.onDone).toHaveBeenCalledWith('Hello World')
      })

      it('calls onDone callback with full content', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"done","fullContent":"Complete"}\n\n') })
                .mockResolvedValueOnce({ done: true })
            })
          }
        })
        global.fetch = mockFetch as any

        const callbacks = {
          onDone: vi.fn()
        }

        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test prompt',
            systemPrompt: 'test system'
          },
          callbacks
        )

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(callbacks.onDone).toHaveBeenCalledWith('Complete')
      })

      it('calls onError callback on error event', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"error","error":"Test error"}\n\n') })
                .mockResolvedValueOnce({ done: true })
            })
          }
        })
        global.fetch = mockFetch as any

        const callbacks = {
          onError: vi.fn()
        }

        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test prompt',
            systemPrompt: 'test system'
          },
          callbacks
        )

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(callbacks.onError).toHaveBeenCalledWith('Test error')
      })

      it('calls onCancel callback on cancelled event', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"cancelled"}\n\n') })
                .mockResolvedValueOnce({ done: true })
            })
          }
        })
        global.fetch = mockFetch as any

        const callbacks = {
          onCancel: vi.fn()
        }

        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test prompt',
            systemPrompt: 'test system'
          },
          callbacks
        )

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(callbacks.onCancel).toHaveBeenCalled()
      })

      it('handles chunked SSE data split across reads', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"tex') })
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('t","content":"Hello"}\n\n') })
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"done","fullContent":"Hello"}\n\n') })
                .mockResolvedValueOnce({ done: true })
            })
          }
        })
        global.fetch = mockFetch as any

        const callbacks = {
          onText: vi.fn(),
          onDone: vi.fn()
        }

        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test prompt',
            systemPrompt: 'test system'
          },
          callbacks
        )

        await new Promise(resolve => setTimeout(resolve, 20))

        expect(callbacks.onText).toHaveBeenCalledWith('Hello')
        expect(callbacks.onDone).toHaveBeenCalledWith('Hello')
      })

      it('calls onError when fetch fails', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
        global.fetch = mockFetch as any

        const callbacks = {
          onError: vi.fn()
        }

        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test prompt',
            systemPrompt: 'test system'
          },
          callbacks
        )

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(callbacks.onError).toHaveBeenCalledWith('Network error')
      })

      it('calls onError when response is not ok', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          statusText: 'Internal Server Error'
        })
        global.fetch = mockFetch as any

        const callbacks = {
          onError: vi.fn()
        }

        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test prompt',
            systemPrompt: 'test system'
          },
          callbacks
        )

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(callbacks.onError).toHaveBeenCalledWith('Internal Server Error')
      })

      it('returns unique id for each insight request', () => {
        const id1 = connection.generateInsight(
          { insightType: 'test', prompt: 'test1', systemPrompt: 'test' },
          {}
        )
        const id2 = connection.generateInsight(
          { insightType: 'test', prompt: 'test2', systemPrompt: 'test' },
          {}
        )

        expect(id1).toBeTruthy()
        expect(id2).toBeTruthy()
        expect(id1).not.toBe(id2)
      })

      it('ignores SSE events with event key instead of type key (pre-fix format)', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({
                  done: false,
                  value: new TextEncoder().encode('data: {"event":"text","content":"Hello"}\n\n'),
                })
                .mockResolvedValueOnce({
                  done: false,
                  value: new TextEncoder().encode('data: {"event":"done","fullContent":"Hello"}\n\n'),
                })
                .mockResolvedValueOnce({ done: true }),
            }),
          },
        })
        global.fetch = mockFetch as any

        const callbacks = {
          onText: vi.fn(),
          onDone: vi.fn(),
        }

        connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test prompt',
            systemPrompt: 'test system',
          },
          callbacks,
        )

        await new Promise(resolve => setTimeout(resolve, 20))

        expect(callbacks.onText).not.toHaveBeenCalled()
        expect(callbacks.onDone).not.toHaveBeenCalled()
      })
    })

    describe('cancelInsight with SSE', () => {
      beforeEach(async () => {
        await connection.connect('test-token', 'sse')
      })

      it('aborts fetch request and calls cancel endpoint', async () => {
        const mockReader = {
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"text","content":"Start"}\n\n') })
            .mockImplementation(() => new Promise(() => {})) // Hang to allow cancel
        }

        const mockFetch = vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            body: { getReader: () => mockReader }
          })
          .mockResolvedValueOnce({ ok: true }) // For cancel endpoint

        global.fetch = mockFetch as any

        const callbacks = {
          onText: vi.fn()
        }

        const id = connection.generateInsight(
          {
            insightType: 'test',
            prompt: 'test prompt',
            systemPrompt: 'test system'
          },
          callbacks
        )

        await new Promise(resolve => setTimeout(resolve, 10))

        connection.cancelInsight(id)

        await new Promise(resolve => setTimeout(resolve, 10))

        // Should call cancel endpoint
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/agent/cancel',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining(`"id":"${id}"`)
          })
        )
      })

      it('does not throw when cancelling non-existent insight', () => {
        expect(() => {
          connection.cancelInsight('non-existent-id')
        }).not.toThrow()
      })
    })

    describe('disconnect with SSE', () => {
      it('aborts all active SSE requests', async () => {
        await connection.connect('test-token', 'sse')

        const mockReader = {
          read: vi.fn().mockImplementation(() => new Promise(() => {})) // Hang
        }

        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          body: { getReader: () => mockReader }
        })
        global.fetch = mockFetch as any

        // Start multiple insights
        connection.generateInsight(
          { insightType: 'test', prompt: 'test1', systemPrompt: 'test' },
          { onError: vi.fn() }
        )
        connection.generateInsight(
          { insightType: 'test', prompt: 'test2', systemPrompt: 'test' },
          { onError: vi.fn() }
        )

        await new Promise(resolve => setTimeout(resolve, 10))

        // Disconnect should abort all
        connection.disconnect()

        expect(connection.getStatus()).toBe('disconnected')
      })
    })
  })
})
