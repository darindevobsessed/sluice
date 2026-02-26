import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock next/server before other imports so requireSession can use it
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 })),
  },
}))

// Mock @/lib/auth so tests don't hit the real DB/betterAuth
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}))

import { verifyCronSecret, safeCompare, requireSession } from '../auth-guards'
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

describe('verifyCronSecret', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns valid: true when secret matches', () => {
    process.env.CRON_SECRET = 'my-secret'
    const request = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer my-secret' },
    })

    const result = verifyCronSecret(request)
    expect(result.valid).toBe(true)
  })

  it('returns 401 when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const request = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer undefined' },
    })

    const result = verifyCronSecret(request)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.response.status).toBe(401)
      expect(await result.response.text()).toBe('Unauthorized')
    }
  })

  it('returns 401 when authorization header is missing', async () => {
    process.env.CRON_SECRET = 'my-secret'
    const request = new Request('http://localhost/api/cron/test')

    const result = verifyCronSecret(request)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.response.status).toBe(401)
    }
  })

  it('returns 401 when secret does not match', async () => {
    process.env.CRON_SECRET = 'my-secret'
    const request = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer wrong-secret' },
    })

    const result = verifyCronSecret(request)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.response.status).toBe(401)
    }
  })

  it('returns 401 when header has wrong prefix', async () => {
    process.env.CRON_SECRET = 'my-secret'
    const request = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Token my-secret' },
    })

    const result = verifyCronSecret(request)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.response.status).toBe(401)
    }
  })
})

describe('safeCompare', () => {
  it('returns true for identical strings', () => {
    expect(safeCompare('abc', 'abc')).toBe(true)
    expect(safeCompare('', '')).toBe(true)
    expect(safeCompare('a-long-token-value', 'a-long-token-value')).toBe(true)
  })

  it('returns false for different strings', () => {
    expect(safeCompare('abc', 'xyz')).toBe(false)
    expect(safeCompare('abc', 'abcd')).toBe(false)
    expect(safeCompare('abc', '')).toBe(false)
    expect(safeCompare('abc', 'ABC')).toBe(false)
  })
})

describe('requireSession', () => {
  const mockGetSession = vi.mocked(auth.api.getSession)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null in development mode without calling getSession', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    const result = await requireSession()

    expect(result).toBeNull()
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('returns null when session is valid in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mockGetSession.mockResolvedValueOnce({ user: { id: '1', email: 'user@devobsessed.com' } } as never)

    const result = await requireSession()

    expect(result).toBeNull()
    expect(mockGetSession).toHaveBeenCalledOnce()
  })

  it('returns 401 response when no session exists in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mockGetSession.mockResolvedValueOnce(null as never)

    const result = await requireSession()

    expect(result).not.toBeNull()
    expect(NextResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 })
  })

  it('returns 401 response in test environment when no session exists', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    mockGetSession.mockResolvedValueOnce(null as never)

    const result = await requireSession()

    expect(result).not.toBeNull()
    expect(NextResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 })
  })
})
