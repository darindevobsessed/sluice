import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the database to avoid connection issues in tests
vi.mock('@/lib/db', () => ({
  db: {},
}))

// Mock @better-auth/oauth-provider — the discovery metadata handler
vi.mock('@better-auth/oauth-provider', () => ({
  oauthProviderAuthServerMetadata: vi.fn(() => {
    return async (): Promise<Response> => {
      const baseUrl = 'http://localhost:3001'
      return new Response(
        JSON.stringify({
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/api/auth/oauth2/authorize`,
          token_endpoint: `${baseUrl}/api/auth/oauth2/token`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
  }),
  oauthProvider: vi.fn(() => ({ id: 'oauth-provider' })),
}))

// Mock better-auth/plugins with jwt (replaced mcp + oAuthDiscoveryMetadata)
vi.mock('better-auth/plugins', () => ({
  jwt: vi.fn(() => ({ id: 'jwt' })),
}))

// Mock better-auth core
vi.mock('better-auth', () => ({
  betterAuth: vi.fn(() => ({
    handler: vi.fn(),
    api: {},
    options: {},
  })),
}))

vi.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: vi.fn(() => ({})),
}))

vi.mock('better-auth/next-js', () => ({
  nextCookies: vi.fn(() => ({ id: 'next-cookies' })),
}))

vi.mock('better-auth/api', () => ({
  APIError: class APIError extends Error {
    constructor(code: string, options?: { message?: string }) {
      super(options?.message ?? code)
      this.name = 'APIError'
    }
  },
}))

// Import the route after mocking
const { GET } = await import('../route')

describe('OAuth Authorization Server Discovery Route', () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  describe('dev mode (non-production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test'
    })

    it('GET returns 404 so MCP clients skip OAuth', async () => {
      const request = new Request('http://localhost:3001/.well-known/oauth-authorization-server')
      const response = await GET(request)
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(404)
    })

    it('GET returns empty body', async () => {
      const request = new Request('http://localhost:3001/.well-known/oauth-authorization-server')
      const response = await GET(request)
      const text = await response.text()
      expect(text).toBe('')
    })
  })

  describe('production mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    it('GET returns 200 with JSON content', async () => {
      const request = new Request('http://localhost:3001/.well-known/oauth-authorization-server')
      const response = await GET(request)
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
    })

    it('GET returns JSON with issuer field', async () => {
      const request = new Request('http://localhost:3001/.well-known/oauth-authorization-server')
      const response = await GET(request)
      const body = await response.json()
      expect(body).toHaveProperty('issuer')
      expect(typeof body.issuer).toBe('string')
    })

    it('GET returns JSON with authorization_endpoint field', async () => {
      const request = new Request('http://localhost:3001/.well-known/oauth-authorization-server')
      const response = await GET(request)
      const body = await response.json()
      expect(body).toHaveProperty('authorization_endpoint')
      expect(typeof body.authorization_endpoint).toBe('string')
    })

    it('GET returns JSON with token_endpoint field', async () => {
      const request = new Request('http://localhost:3001/.well-known/oauth-authorization-server')
      const response = await GET(request)
      const body = await response.json()
      expect(body).toHaveProperty('token_endpoint')
      expect(typeof body.token_endpoint).toBe('string')
    })

    it('GET returns all required OAuth discovery fields', async () => {
      const request = new Request('http://localhost:3001/.well-known/oauth-authorization-server')
      const response = await GET(request)
      const body = await response.json()
      expect(body).toHaveProperty('issuer')
      expect(body).toHaveProperty('authorization_endpoint')
      expect(body).toHaveProperty('token_endpoint')
    })

    it('GET returns oauth2 endpoint paths (not mcp paths)', async () => {
      const request = new Request('http://localhost:3001/.well-known/oauth-authorization-server')
      const response = await GET(request)
      const body = await response.json()
      expect(body.authorization_endpoint).toContain('/oauth2/authorize')
      expect(body.token_endpoint).toContain('/oauth2/token')
    })
  })
})
