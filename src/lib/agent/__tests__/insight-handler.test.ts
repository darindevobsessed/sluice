/**
 * Tests for transport-agnostic insight handler
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleInsightRequest, cancelInsight, type InsightRequest, type SendFn } from '../insight-handler'

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}))

import { query, type Query } from '@anthropic-ai/claude-agent-sdk'

describe('handleInsightRequest', () => {
  let sendMock: ReturnType<typeof vi.fn<SendFn>>
  let testRequest: InsightRequest

  beforeEach(() => {
    sendMock = vi.fn<SendFn>()
    testRequest = {
      id: 'test-id-123',
      type: 'generate_insight',
      prompt: 'Test prompt',
      systemPrompt: 'Test system prompt',
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls send with text events during streaming', async () => {
    // Mock streaming response with text deltas
    const mockAsyncGenerator = async function* () {
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello ' },
        },
      }
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'world' },
        },
      }
      yield {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Hello world' }],
        },
      }
    }

    vi.mocked(query).mockReturnValue(mockAsyncGenerator() as unknown as Query)

    await handleInsightRequest(sendMock, testRequest)

    // Should send text events for each delta
    expect(sendMock).toHaveBeenCalledWith({ event: 'text', content: 'Hello ' })
    expect(sendMock).toHaveBeenCalledWith({ event: 'text', content: 'world' })
    // Should send done event with full content
    expect(sendMock).toHaveBeenCalledWith({ event: 'done', fullContent: 'Hello world' })
    expect(sendMock).toHaveBeenCalledTimes(3)
  })

  it('calls send with done event on completion', async () => {
    // Mock response without streaming (assistant message only)
    const mockAsyncGenerator = async function* () {
      yield {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Final result' }],
        },
      }
    }

    vi.mocked(query).mockReturnValue(mockAsyncGenerator() as unknown as Query)

    await handleInsightRequest(sendMock, testRequest)

    // Should send text event with full content
    expect(sendMock).toHaveBeenCalledWith({ event: 'text', content: 'Final result' })
    // Should send done event
    expect(sendMock).toHaveBeenCalledWith({ event: 'done', fullContent: 'Final result' })
    expect(sendMock).toHaveBeenCalledTimes(2)
  })

  it('calls send with error event on failure', async () => {
    // Mock query throwing an error
    vi.mocked(query).mockImplementation(() => {
      throw new Error('API failure')
    })

    await handleInsightRequest(sendMock, testRequest)

    // Should send error event
    expect(sendMock).toHaveBeenCalledWith({ event: 'error', error: 'API failure' })
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('handles non-Error exceptions', async () => {
    // Mock query throwing a non-Error object
    vi.mocked(query).mockImplementation(() => {
      throw 'String error'
    })

    await handleInsightRequest(sendMock, testRequest)

    // Should send error event with generic message
    expect(sendMock).toHaveBeenCalledWith({ event: 'error', error: 'Unknown error' })
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('calls send with cancelled event when aborted during streaming', async () => {
    // Mock streaming that will be aborted
    const mockAsyncGenerator = async function* () {
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Start ' },
        },
      }
      // Wait a bit to allow cancellation to happen
      await new Promise((resolve) => setTimeout(resolve, 20))
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'interrupted' },
        },
      }
    }

    vi.mocked(query).mockReturnValue(mockAsyncGenerator() as unknown as Query)

    // Start the request
    const promise = handleInsightRequest(sendMock, testRequest)

    // Wait for first yield, then cancel
    await new Promise((resolve) => setTimeout(resolve, 10))
    const cancelled = cancelInsight(testRequest.id)

    await promise

    expect(cancelled).toBe(true)
    // Should have sent text event before cancellation
    expect(sendMock).toHaveBeenCalledWith({ event: 'text', content: 'Start ' })
    // Should send cancelled event
    expect(sendMock).toHaveBeenCalledWith({ event: 'cancelled' })
  })

  it('passes combined system prompt and prompt to Claude', async () => {
    const mockAsyncGenerator = async function* () {
      yield {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Result' }],
        },
      }
    }

    vi.mocked(query).mockReturnValue(mockAsyncGenerator() as unknown as Query)

    await handleInsightRequest(sendMock, testRequest)

    // Verify query was called with combined prompt
    expect(query).toHaveBeenCalledWith({
      prompt: 'Test system prompt\n\n---\n\nTest prompt',
      options: expect.objectContaining({
        model: 'claude-sonnet-4-20250514',
        maxTurns: 1,
        tools: [],
        includePartialMessages: true,
        persistSession: false,
      }),
    })
  })

  it('ignores non-text content blocks', async () => {
    // Mock response with non-text content block
    const mockAsyncGenerator = async function* () {
      yield {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'tool123', name: 'test_tool' },
            { type: 'text', text: 'Text content' },
          ],
        },
      }
    }

    vi.mocked(query).mockReturnValue(mockAsyncGenerator() as unknown as Query)

    await handleInsightRequest(sendMock, testRequest)

    // Should only send text content
    expect(sendMock).toHaveBeenCalledWith({ event: 'text', content: 'Text content' })
    expect(sendMock).toHaveBeenCalledWith({ event: 'done', fullContent: 'Text content' })
    expect(sendMock).toHaveBeenCalledTimes(2)
  })

  it('handles empty streaming delta gracefully', async () => {
    // Mock streaming with empty delta
    const mockAsyncGenerator = async function* () {
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: '' },
        },
      }
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Content' },
        },
      }
      yield {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Content' }],
        },
      }
    }

    vi.mocked(query).mockReturnValue(mockAsyncGenerator() as unknown as Query)

    await handleInsightRequest(sendMock, testRequest)

    // Should skip empty delta, only send non-empty
    expect(sendMock).toHaveBeenCalledWith({ event: 'text', content: 'Content' })
    expect(sendMock).toHaveBeenCalledWith({ event: 'done', fullContent: 'Content' })
    expect(sendMock).toHaveBeenCalledTimes(2)
  })
})

describe('cancelInsight', () => {
  let sendMock: ReturnType<typeof vi.fn<SendFn>>
  let testRequest: InsightRequest

  beforeEach(() => {
    sendMock = vi.fn<SendFn>()
    testRequest = {
      id: 'cancel-test-id',
      type: 'generate_insight',
      prompt: 'Test prompt',
      systemPrompt: 'Test system prompt',
    }
    vi.clearAllMocks()
  })

  it('returns true and aborts when request exists', async () => {
    // Mock a long-running request
    const mockAsyncGenerator = async function* () {
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Start' },
        },
      }
      // Simulate long operation
      await new Promise((resolve) => setTimeout(resolve, 100))
      yield {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Complete' }],
        },
      }
    }

    vi.mocked(query).mockReturnValue(mockAsyncGenerator() as unknown as Query)

    // Start the request (don't await)
    const promise = handleInsightRequest(sendMock, testRequest)

    // Wait a bit for request to start
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Cancel the request
    const cancelled = cancelInsight(testRequest.id)

    expect(cancelled).toBe(true)

    // Wait for handler to finish
    await promise
  })

  it('returns false when request does not exist', () => {
    const cancelled = cancelInsight('non-existent-id')
    expect(cancelled).toBe(false)
  })

  it('returns false when called twice for same request', async () => {
    // Mock a request
    const mockAsyncGenerator = async function* () {
      yield {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Result' }],
        },
      }
    }

    vi.mocked(query).mockReturnValue(mockAsyncGenerator() as unknown as Query)

    // Start and immediately cancel
    const promise = handleInsightRequest(sendMock, testRequest)
    const firstCancel = cancelInsight(testRequest.id)
    const secondCancel = cancelInsight(testRequest.id)

    await promise

    expect(firstCancel).toBe(true)
    expect(secondCancel).toBe(false)
  })
})
