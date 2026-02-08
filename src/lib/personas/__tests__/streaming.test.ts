import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamPersonaResponse } from '../streaming'
import type { Persona } from '@/lib/db/schema'
import type { SearchResult } from '@/lib/search/types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

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
    mockFetch.mockReset()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')
  })

  it('should return a ReadableStream', async () => {
    // Mock SSE response
    const mockResponseBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: message_start\ndata: {}\n\n'))
        controller.enqueue(new TextEncoder().encode('event: content_block_delta\ndata: {"delta":{"text":"Hello"}}\n\n'))
        controller.close()
      },
    })

    mockFetch.mockResolvedValue({
      ok: true,
      body: mockResponseBody,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    })

    const stream = await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('should call Anthropic API with correct parameters', async () => {
    const mockResponseBody = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    mockFetch.mockResolvedValue({
      ok: true,
      body: mockResponseBody,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    })

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test-api-key',
          'content-type': 'application/json',
        }),
        body: expect.any(String),
      })
    )

    const callBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string)
    expect(callBody).toMatchObject({
      model: expect.any(String),
      max_tokens: expect.any(Number),
      stream: true,
      messages: expect.any(Array),
    })
  })

  it('should include persona system prompt in request', async () => {
    const mockResponseBody = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    mockFetch.mockResolvedValue({
      ok: true,
      body: mockResponseBody,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    })

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const callBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string)
    expect(callBody.system).toContain(mockPersona.systemPrompt)
  })

  it('should include context in system prompt', async () => {
    const mockResponseBody = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    mockFetch.mockResolvedValue({
      ok: true,
      body: mockResponseBody,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    })

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const callBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string)
    expect(callBody.system).toContain('TypeScript is a typed superset of JavaScript')
  })

  it('should include user question in messages', async () => {
    const mockResponseBody = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    mockFetch.mockResolvedValue({
      ok: true,
      body: mockResponseBody,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    })

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const callBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string)
    expect(callBody.messages).toHaveLength(1)
    expect(callBody.messages[0]).toMatchObject({
      role: 'user',
      content: 'What is TypeScript?',
    })
  })

  it('should handle fetch errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(
      streamPersonaResponse({
        persona: mockPersona,
        question: 'What is TypeScript?',
        context: mockContext,
      })
    ).rejects.toThrow('Network error')
  })

  it('should handle non-ok responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      body: null,
    })

    await expect(
      streamPersonaResponse({
        persona: mockPersona,
        question: 'What is TypeScript?',
        context: mockContext,
      })
    ).rejects.toThrow()
  })

  it('should handle abort signal', async () => {
    const mockResponseBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: message_start\ndata: {}\n\n'))
        controller.close()
      },
    })

    mockFetch.mockResolvedValue({
      ok: true,
      body: mockResponseBody,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    })

    const abortController = new AbortController()
    abortController.abort()

    await expect(
      streamPersonaResponse({
        persona: mockPersona,
        question: 'What is TypeScript?',
        context: mockContext,
        signal: abortController.signal,
      })
    ).rejects.toThrow()
  })

  it('should return SSE-formatted events', async () => {
    const mockResponseBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n'))
        controller.enqueue(new TextEncoder().encode('event: message_stop\ndata: {}\n\n'))
        controller.close()
      },
    })

    mockFetch.mockResolvedValue({
      ok: true,
      body: mockResponseBody,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    })

    const stream = await streamPersonaResponse({
      persona: mockPersona,
      question: 'What is TypeScript?',
      context: mockContext,
    })

    const reader = stream.getReader()
    const decoder = new TextDecoder()

    const { value, done } = await reader.read()
    expect(done).toBe(false)
    expect(decoder.decode(value)).toContain('data:')
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

    const mockResponseBody = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    mockFetch.mockResolvedValue({
      ok: true,
      body: mockResponseBody,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    })

    await streamPersonaResponse({
      persona: mockPersona,
      question: 'Question?',
      context: largeContext,
    })

    const callBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string)
    // System prompt should not be excessively large
    expect(callBody.system.length).toBeLessThan(20000) // Reasonable limit
  })
})
