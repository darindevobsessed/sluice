/**
 * Tests for agent cancel API route
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '../route'
import { cancelInsight } from '@/lib/agent/insight-handler'
import { safeCompare } from '@/lib/auth-guards'

// Mock the insight handler
vi.mock('@/lib/agent/insight-handler', () => ({
  cancelInsight: vi.fn(),
}))

// Mock auth-guards with safeCompare that preserves existing behavior
vi.mock('@/lib/auth-guards', () => ({
  safeCompare: vi.fn((a: string, b: string) => a === b),
}))

const mockCancelInsight = vi.mocked(cancelInsight)
const mockSafeCompare = vi.mocked(safeCompare)

describe('POST /api/agent/cancel', () => {
  const validPayload = {
    id: 'test-123',
    token: 'valid-token',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock environment variable
    process.env.AGENT_AUTH_TOKEN = 'valid-token'

    // Default mock: successful cancellation
    mockCancelInsight.mockReturnValue(true)
  })

  it('returns 503 if AGENT_AUTH_TOKEN is not set', async () => {
    delete process.env.AGENT_AUTH_TOKEN

    const request = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    const response = await POST(request)

    expect(response.status).toBe(503)
    const data = await response.json()
    expect(data.error).toContain('Agent authentication not configured')
  })

  it('returns 401 if token is invalid', async () => {
    const request = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, token: 'wrong-token' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toContain('Invalid token')
  })

  it('uses safeCompare for timing-safe token validation', async () => {
    const request = new Request('http://localhost/api/agent/cancel', {
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
    const request = new Request('http://localhost/api/agent/cancel', {
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
    const request = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify({ id: 'test-123' }), // Missing token
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 400 if id is empty', async () => {
    const request = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, id: '' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 400 if token is empty', async () => {
    const request = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, token: '' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 400 if JSON is malformed', async () => {
    const request = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: 'invalid json',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('Invalid JSON')
  })

  it('returns success when insight is cancelled', async () => {
    mockCancelInsight.mockReturnValue(true)

    const request = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ cancelled: true })
  })

  it('returns success when insight was not found', async () => {
    mockCancelInsight.mockReturnValue(false)

    const request = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ cancelled: false })
  })

  it('calls cancelInsight with correct id', async () => {
    const request = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    await POST(request)

    expect(mockCancelInsight).toHaveBeenCalledWith('test-123')
  })

  it('validates all fields are strings', async () => {
    const request = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify({ id: 123, token: 'valid-token' }), // id should be string
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
  })

  it('handles multiple cancellation requests for same id', async () => {
    const request1 = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    const request2 = new Request('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    })

    mockCancelInsight.mockReturnValueOnce(true).mockReturnValueOnce(false)

    const response1 = await POST(request1)
    const response2 = await POST(request2)

    expect(response1.status).toBe(200)
    expect(response2.status).toBe(200)

    const data1 = await response1.json()
    const data2 = await response2.json()

    expect(data1.cancelled).toBe(true)
    expect(data2.cancelled).toBe(false)
  })
})
