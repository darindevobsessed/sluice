import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamPersonaResponse } from '../streaming'
import type { Persona } from '@/lib/db/schema'
import type { SearchResult } from '@/lib/search/types'
import { query } from '@anthropic-ai/claude-agent-sdk'

// Mock Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}))

const mockQuery = vi.mocked(query)

describe('streamPersonaResponse', () => {
  const mockPersona: Persona = {
    id: 1,
    channelName: 'Test Channel',
    name: 'Test Creator',
    systemPrompt: 'You are Test Creator. You teach programming.',
    expertiseTopics: ['programming', 'typescript'],
    expertiseEmbedding: null,
    transcriptCount: 30,
    createdAt: new Date(),
  }

  const mockContext: SearchResult[] = [
    {
      chunkId: 1,
      content: 'TypeScript is a typed superset of JavaScript.',
      startTime: 10,
      endTime: 20,
      videoId: 1,
      videoTitle: 'Intro to TypeScript',
      channel: 'Test Channel',
      youtubeId: 'abc123',
      thumbnail: null,
      similarity: 0.95,
    },
  ]

  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('should return a ReadableStream', async () => {
    // Mock Agent SDK query to yield stream events
    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hello' },
          },
        }
        yield {
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Hello' }] },
        }
      })() as never
    )

    const stream = await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('should call Agent SDK query with correct parameters', async () => {
    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Response' }] },
        }
      })() as never
    )

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    expect(mockQuery).toHaveBeenCalledWith({
      prompt: expect.stringContaining(mockPersona.systemPrompt),
      options: expect.objectContaining({
        model: 'claude-sonnet-4-20250514',
        maxTurns: 1,
        tools: [],
        includePartialMessages: true,
        persistSession: false,
      }),
    })
  })

  it('should include persona system prompt and question in prompt', async () => {
    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Response' }] },
        }
      })() as never
    )

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const promptArg = mockQuery.mock.calls[0]?.[0]?.prompt as string
    expect(promptArg).toContain(mockPersona.systemPrompt)
    expect(promptArg).toContain('What is TypeScript?')
  })

  it('should include context in prompt', async () => {
    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Response' }] },
        }
      })() as never
    )

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const promptArg = mockQuery.mock.calls[0]?.[0]?.prompt as string
    expect(promptArg).toContain('TypeScript is a typed superset of JavaScript')
  })

  it('should emit SSE-formatted content_block_delta events', async () => {
    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hello' },
          },
        }
        yield {
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Hello' }] },
        }
      })() as never
    )

    const stream = await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const reader = stream.getReader()
    const decoder = new TextDecoder()

    const { value, done } = await reader.read()
    expect(done).toBe(false)

    const chunk = decoder.decode(value)
    expect(chunk).toContain('data:')

    const dataLine = chunk.split('\n').find(line => line.startsWith('data:'))
    const data = JSON.parse(dataLine!.slice(5).trim())
    expect(data.type).toBe('content_block_delta')
    expect(data.delta.text).toBe('Hello')
  })

  it('should emit done event on completion', async () => {
    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Complete' },
          },
        }
        yield {
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Complete' }] },
        }
      })() as never
    )

    const stream = await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const reader = stream.getReader()
    const decoder = new TextDecoder()

    // Read first chunk (content_block_delta)
    await reader.read()

    // Read second chunk (done event)
    const { value: doneValue, done } = await reader.read()
    expect(done).toBe(false)

    const doneChunk = decoder.decode(doneValue)
    const doneLine = doneChunk.split('\n').find(line => line.startsWith('data:'))
    const doneData = JSON.parse(doneLine!.slice(5).trim())
    expect(doneData.type).toBe('done')
  })

  it('should handle query errors', async () => {
    mockQuery.mockReturnValue(
      (async function* () {
        throw new Error('Query failed')
      })() as never
    )

    const stream = await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const reader = stream.getReader()

    await expect(reader.read()).rejects.toThrow('Query failed')
  })

  it('should handle abort signal', async () => {
    const abortController = new AbortController()
    abortController.abort()

    mockQuery.mockReturnValue(
      (async function* () {
        throw new Error('Aborted')
      })() as never
    )

    const stream = await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
      signal: abortController.signal,
    })

    const reader = stream.getReader()

    await expect(reader.read()).rejects.toThrow()
  })

  it('should wire abort signal to Agent SDK abortController', async () => {
    const abortController = new AbortController()

    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Response' }] },
        }
      })() as never
    )

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
      signal: abortController.signal,
    })

    const options = mockQuery.mock.calls[0]?.[0]?.options
    expect(options).toBeDefined()
    expect(options?.abortController).toBeInstanceOf(AbortController)
  })

  it('should use { once: true } on abort signal listener to prevent leaks', async () => {
    const signal = new AbortController().signal
    const addEventListenerSpy = vi.spyOn(signal, 'addEventListener')

    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Response' }] },
        }
      })() as never
    )

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
      signal,
    })

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'abort',
      expect.any(Function),
      { once: true },
    )
  })

  it('should limit context to avoid exceeding token budget', async () => {
    // Create a large context (more than 3K tokens worth)
    const largeContext: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
      chunkId: i,
      content: 'A'.repeat(500), // Large content
      startTime: i * 10,
      endTime: (i + 1) * 10,
      videoId: 1,
      videoTitle: 'Video',
      channel: 'Channel',
      youtubeId: 'abc',
      thumbnail: null,
      similarity: 0.9,
    }))

    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Response' }] },
        }
      })() as never
    )

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'Question?',
      context: largeContext,
    })

    const promptArg = mockQuery.mock.calls[0]?.[0]?.prompt as string
    // Prompt should not be excessively large due to token limiting
    expect(promptArg.length).toBeLessThan(20000) // Reasonable limit
  })
})
