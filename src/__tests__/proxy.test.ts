import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock better-auth/cookies -- control getSessionCookie return per test
const mockGetSessionCookie = vi.fn()
vi.mock('better-auth/cookies', () => ({
  getSessionCookie: (...args: unknown[]) => mockGetSessionCookie(...args),
}))

// Import after mocking
const { proxy, config } = await import('../proxy')

/**
 * Helper to create a NextRequest for testing.
 * NextRequest requires a fully-qualified URL.
 */
function createRequest(pathname: string, method = 'GET'): NextRequest {
  return new NextRequest(new URL(pathname, 'http://localhost:3001'), {
    method,
  })
}

describe('proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('development mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
    })

    it('passes all requests through without auth check', () => {
      const response = proxy(createRequest('/discovery'))

      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(mockGetSessionCookie).not.toHaveBeenCalled()
    })
  })

  describe('config', () => {
    it('exports a matcher config', () => {
      expect(config).toBeDefined()
      expect(config.matcher).toBeDefined()
      expect(Array.isArray(config.matcher)).toBe(true)
      expect(config.matcher.length).toBeGreaterThan(0)
    })
  })
})
