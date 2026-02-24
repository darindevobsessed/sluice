/**
 * Tests for agent stream API route
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '../route'
import { handleInsightRequest } from '@/lib/agent/insight-handler'
import { safeCompare } from '@/lib/auth-guards'

// Mock the insight handler
vi.mock('@/lib/agent/insight-handler', () => ({
  handleInsightRequest: vi.fn(),
}))

// Mock auth-guards with safeCompare that preserves existing behavior
vi.mock('@/lib/auth-guards', () => ({
  safeCompare: vi.fn((a: string, b: string) => a === b),
}))

const mockHandleInsightRequest = vi.mocked(handleInsightRequest)
const mockSafeCompare = vi.mocked(safeCompare)

describe('POST /api/agent/stream', () => {
  const validPayload = {
    id: 'test-123',
    prompt: 'Generate insights for this video',
    systemPrompt: 'You are a helpful assistant',
    token: 'valid-token',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock environment variable
    process.env.AGENT_AUTH_TOKEN = 'valid-token'

    // Default mock: successful handler execution
    mockHandleInsightRequest.mockImplementation(async (send) => {
      send({ event: 'text', content: 'Test insight' })
      send({ event: 'done', fullContent: 'Test insight' })
    })
  })

  it('returns 503 if AGENT_AUTH_TOKEN is not set', async () => {
    delete process.env.AGENT_AUTH_TOKEN

    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    const response = await POST(request)

    expect(response.status).toBe(503)
    const data = await response.json()
    expect(data.error).toContain('Agent authentication not configured')
  })

  it('returns 401 if token is invalid', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, token: 'wrong-token' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toContain('Invalid token')
  })

  it('uses safeCompare for timing-safe token validation', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    await POST(request)

    expect(mockSafeCompare).toHaveBeenCalledWith(
      validPayload.token,
      process.env.AGENT_AUTH_TOKEN
    )
  })

  it('uses safeCompare even when token is wrong', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, token: 'wrong-token' }),
    })

    await POST(request)

    expect(mockSafeCompare).toHaveBeenCalledWith(
      'wrong-token',
      process.env.AGENT_AUTH_TOKEN
    )
  })

  it('returns 400 if request body is missing required fields', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify({ id: 'test-123' }), // Missing prompt, systemPrompt, token
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 400 if id is empty', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, id: '' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 400 if prompt is empty', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, prompt: '' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 400 if systemPrompt is empty', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, systemPrompt: '' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 400 if token is empty', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, token: '' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 400 if JSON is malformed', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: 'invalid json',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('Invalid JSON')
  })

  it('returns SSE stream for valid request', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(response.headers.get('connection')).toBe('keep-alive')
  })

  it('calls handleInsightRequest with correct parameters', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    const response = await POST(request)

    // Read the stream to trigger handler execution
    const reader = response.body?.getReader()
    if (reader) {
      await reader.read()
      reader.releaseLock()
    }

    expect(mockHandleInsightRequest).toHaveBeenCalledWith(
      expect.any(Function),
      {
        id: validPayload.id,
        type: 'generate',
        prompt: validPayload.prompt,
        systemPrompt: validPayload.systemPrompt,
      }
    )
  })

  it('sends events through SSE stream', async () => {
    mockHandleInsightRequest.mockImplementation(async (send) => {
      send({ event: 'text', content: 'First chunk' })
      send({ event: 'text', content: 'Second chunk' })
      send({ event: 'done', fullContent: 'First chunkSecond chunk' })
    })

    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    const response = await POST(request)
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No reader available')
    }

    const chunks: string[] = []
    let done = false
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        chunks.push(decoder.decode(value, { stream: true }))
      }
    }

    const fullResponse = chunks.join('')
    // Updated: Chunk 1 translates insight-handler's { event } to SSE client's { type }
    expect(fullResponse).toContain('data: {"type":"text","content":"First chunk"}')
    expect(fullResponse).toContain('data: {"type":"text","content":"Second chunk"}')
    expect(fullResponse).toContain('data: {"type":"done","fullContent":"First chunkSecond chunk"}')
  })

  it('handles handler errors gracefully', async () => {
    mockHandleInsightRequest.mockImplementation(async (send) => {
      send({ event: 'error', error: 'Something went wrong' })
    })

    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    const response = await POST(request)
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No reader available')
    }

    const chunks: string[] = []
    let done = false
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        chunks.push(decoder.decode(value, { stream: true }))
      }
    }

    const fullResponse = chunks.join('')
    // Updated: Chunk 1 translates insight-handler's { event } to SSE client's { type }
    expect(fullResponse).toContain('data: {"type":"error","error":"Something went wrong"}')
  })

  it('validates all fields are strings', async () => {
    const request = new Request('http://localhost/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, id: 123 }), // id should be string
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
  })
})
