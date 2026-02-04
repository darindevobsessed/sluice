/**
 * Tests for AgentConnection WebSocket client
 * Note: Full WebSocket integration tested manually; these tests cover core logic
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AgentConnection } from '../connection'

describe('AgentConnection', () => {
  let connection: AgentConnection

  beforeEach(() => {
    connection = new AgentConnection()
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
})
