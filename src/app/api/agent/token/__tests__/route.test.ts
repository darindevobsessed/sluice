/**
 * Tests for agent token API route
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '../route'
import fs from 'fs'
import path from 'path'

// Mock auth module
const mockGetSession = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}))

// Mock next/headers
const mockHeaders = vi.fn()
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
}))

// Store original env
const originalEnv = process.env.AGENT_AUTH_TOKEN

describe('GET /api/agent/token', () => {
  const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>
  const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.AGENT_AUTH_TOKEN
    mockGetSession.mockResolvedValue({ user: { id: '1', email: 'test@devobsessed.com' } })
    mockHeaders.mockResolvedValue(new Headers())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalEnv !== undefined) {
      process.env.AGENT_AUTH_TOKEN = originalEnv
    } else {
      delete process.env.AGENT_AUTH_TOKEN
    }
  })

  it('returns 401 when no session exists', async () => {
    mockGetSession.mockResolvedValue(null)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns token with websocket transport when file exists and is valid', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('abc-123-xyz')

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      token: 'abc-123-xyz',
      available: true,
      transport: 'websocket',
    })
  })

  it('trims whitespace from token', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('  abc-123-xyz  \n')

    const response = await GET()
    const data = await response.json()

    expect(data.token).toBe('abc-123-xyz')
    expect(data.transport).toBe('websocket')
  })

  it('falls back to env var when file does not exist', async () => {
    mockExistsSync.mockReturnValue(false)
    process.env.AGENT_AUTH_TOKEN = 'env-token-123'

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      token: 'env-token-123',
      available: true,
      transport: 'sse',
    })
  })

  it('falls back to env var when token file is empty', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('')
    process.env.AGENT_AUTH_TOKEN = 'env-token-456'

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      token: 'env-token-456',
      available: true,
      transport: 'sse',
    })
  })

  it('falls back to env var when token file is only whitespace', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('   \n  \t  ')
    process.env.AGENT_AUTH_TOKEN = 'env-token-789'

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      token: 'env-token-789',
      available: true,
      transport: 'sse',
    })
  })

  it('falls back to env var when file read fails', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation(() => {
      throw new Error('Permission denied')
    })
    process.env.AGENT_AUTH_TOKEN = 'env-token-fallback'

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      token: 'env-token-fallback',
      available: true,
      transport: 'sse',
    })
  })

  it('reads from correct file path', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('abc-123-xyz')

    await GET()

    const expectedPath = path.join(process.cwd(), '.agent-token')
    expect(mockExistsSync).toHaveBeenCalledWith(expectedPath)
    expect(mockReadFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8')
  })

  it('returns 503 when neither file nor env var available', async () => {
    mockExistsSync.mockReturnValue(false)
    delete process.env.AGENT_AUTH_TOKEN

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data).toEqual({
      error: 'Agent not available',
      available: false,
    })
  })

  it('returns 503 when file empty and no env var', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('')
    delete process.env.AGENT_AUTH_TOKEN

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data).toEqual({
      error: 'Agent not available',
      available: false,
    })
  })

  it('returns 503 when file read fails and no env var', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation(() => {
      throw new Error('Permission denied')
    })
    delete process.env.AGENT_AUTH_TOKEN

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data).toEqual({
      error: 'Agent not available',
      available: false,
    })
  })

  it('falls back to env var when non-Error exception occurs', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation(() => {
      throw 'String error'
    })
    process.env.AGENT_AUTH_TOKEN = 'env-token-exception'

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      token: 'env-token-exception',
      available: true,
      transport: 'sse',
    })
  })

  it('prefers filesystem token over env var', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('file-token')
    process.env.AGENT_AUTH_TOKEN = 'env-token'

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      token: 'file-token',
      available: true,
      transport: 'websocket',
    })
  })
})
