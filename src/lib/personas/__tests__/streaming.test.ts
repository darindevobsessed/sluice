import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamPersonaResponse } from '../streaming'
import type { Persona } from '@/lib/db/schema'
import type { SearchResult } from '@/lib/search/types'
import { streamText } from '@/lib/claude/client'

// Mock claude client
vi.mock('@/lib/claude/client', () => ({
  streamText: vi.fn(),
}))

const mockStreamText = vi.mocked(streamText)

/** Helper to create a mock stream that mimics MessageStream */
function createMockStream(options: {
  contentBlockDeltas?: Array<{ type: string, index: number, delta: { type: string, text: string } }>
  finalContent?: string
  error?: Error
}) {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()

  const stream = {
    on(event: string, cb: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event)!.push(cb)
      return stream
    },
    finalMessage: vi.fn(async () => {
      if (options.error) throw options.error

      // Emit streamEvent events (raw API events, same as MessageStream)
      if (options.contentBlockDeltas) {
        for (const delta of options.contentBlockDeltas) {
          for (const cb of listeners.get('streamEvent') ?? []) {
            cb(delta)
          }
        }
      }

      return {
        content: [{ type: 'text' as const, text: options.finalContent ?? '' }],
      }
    }),
  }

  return stream
}

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
    mockStreamText.mockReset()
  })

  it('should return a ReadableStream', async () => {
    const mockStream = createMockStream({
      contentBlockDeltas: [{
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello' },
      }],
      finalContent: 'Hello',
    })

    mockStreamText.mockReturnValue(mockStream as never)

    const stream = await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('should call streamText with correct prompt', async () => {
    const mockStream = createMockStream({
      contentBlockDeltas: [],
      finalContent: 'Response',
    })

    mockStreamText.mockReturnValue(mockStream as never)

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.stringContaining(mockPersona.systemPrompt),
      expect.any(Object),
    )
  })

  it('should include persona system prompt and question in prompt', async () => {
    const mockStream = createMockStream({
      contentBlockDeltas: [],
      finalContent: 'Response',
    })

    mockStreamText.mockReturnValue(mockStream as never)

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const promptArg = mockStreamText.mock.calls[0]?.[0] as string
    expect(promptArg).toContain(mockPersona.systemPrompt)
    expect(promptArg).toContain('What is TypeScript?')
  })

  it('should include context in prompt', async () => {
    const mockStream = createMockStream({
      contentBlockDeltas: [],
      finalContent: 'Response',
    })

    mockStreamText.mockReturnValue(mockStream as never)

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const promptArg = mockStreamText.mock.calls[0]?.[0] as string
    expect(promptArg).toContain('TypeScript is a typed superset of JavaScript')
  })

  it('should emit SSE-formatted content_block_delta events', async () => {
    const mockStream = createMockStream({
      contentBlockDeltas: [{
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello' },
      }],
      finalContent: 'Hello',
    })

    mockStreamText.mockReturnValue(mockStream as never)

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
    const mockStream = createMockStream({
      contentBlockDeltas: [{
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Complete' },
      }],
      finalContent: 'Complete',
    })

    mockStreamText.mockReturnValue(mockStream as never)

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
    const mockStream = createMockStream({
      error: new Error('Query failed'),
    })

    mockStreamText.mockReturnValue(mockStream as never)

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

    const mockStream = createMockStream({
      error: new Error('Aborted'),
    })

    mockStreamText.mockReturnValue(mockStream as never)

    const stream = await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
      signal: abortController.signal,
    })

    const reader = stream.getReader()

    await expect(reader.read()).rejects.toThrow()
  })

  it('should pass abort signal to streamText', async () => {
    const abortController = new AbortController()

    const mockStream = createMockStream({
      contentBlockDeltas: [],
      finalContent: 'Response',
    })

    mockStreamText.mockReturnValue(mockStream as never)

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
      signal: abortController.signal,
    })

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: abortController.signal,
      }),
    )
  })

  it('should include conversation history in prompt when provided', async () => {
    const mockStream = createMockStream({
      contentBlockDeltas: [],
      finalContent: 'Response',
    })

    mockStreamText.mockReturnValue(mockStream as never)

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What about hooks?',
      context: mockContext,
      history: [
        { question: 'What is TypeScript?', answer: 'TypeScript is a typed superset of JavaScript.' },
      ],
    })

    const promptArg = mockStreamText.mock.calls[0]?.[0] as string
    expect(promptArg).toContain('Recent conversation history:')
    expect(promptArg).toContain('User: What is TypeScript?')
    expect(promptArg).toContain('You: TypeScript is a typed superset of JavaScript.')
    expect(promptArg).toContain('Continue the conversation naturally')
  })

  it('should not include history section when history is empty', async () => {
    const mockStream = createMockStream({
      contentBlockDeltas: [],
      finalContent: 'Response',
    })

    mockStreamText.mockReturnValue(mockStream as never)

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
      history: [],
    })

    const promptArg = mockStreamText.mock.calls[0]?.[0] as string
    expect(promptArg).not.toContain('Recent conversation history:')
    expect(promptArg).not.toContain('Continue the conversation naturally')
  })

  it('should not include history section when history is omitted', async () => {
    const mockStream = createMockStream({
      contentBlockDeltas: [],
      finalContent: 'Response',
    })

    mockStreamText.mockReturnValue(mockStream as never)

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const promptArg = mockStreamText.mock.calls[0]?.[0] as string
    expect(promptArg).not.toContain('Recent conversation history:')
  })

  it('should format multiple history items as User/You pairs', async () => {
    const mockStream = createMockStream({
      contentBlockDeltas: [],
      finalContent: 'Response',
    })

    mockStreamText.mockReturnValue(mockStream as never)

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What about generics?',
      context: mockContext,
      history: [
        { question: 'What is TypeScript?', answer: 'A typed superset of JavaScript.' },
        { question: 'What are interfaces?', answer: 'Interfaces define the shape of objects.' },
      ],
    })

    const promptArg = mockStreamText.mock.calls[0]?.[0] as string
    expect(promptArg).toContain('User: What is TypeScript?')
    expect(promptArg).toContain('You: A typed superset of JavaScript.')
    expect(promptArg).toContain('User: What are interfaces?')
    expect(promptArg).toContain('You: Interfaces define the shape of objects.')
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

    const mockStream = createMockStream({
      contentBlockDeltas: [],
      finalContent: 'Response',
    })

    mockStreamText.mockReturnValue(mockStream as never)

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'Question?',
      context: largeContext,
    })

    const promptArg = mockStreamText.mock.calls[0]?.[0] as string
    // Prompt should not be excessively large due to token limiting
    expect(promptArg.length).toBeLessThan(20000) // Reasonable limit
  })
})
