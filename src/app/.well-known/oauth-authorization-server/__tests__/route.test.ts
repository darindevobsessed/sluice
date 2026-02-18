import { describe, it, expect, vi } from 'vitest'

// Mock the database to avoid connection issues in tests
vi.mock('@/lib/db', () => ({
  db: {},
}))

// Mock better-auth mcp plugin oAuthDiscoveryMetadata to return a realistic response
vi.mock('better-auth/plugins', () => ({
  mcp: vi.fn(() => ({ id: 'mcp', hooks: { after: [] }, endpoints: {}, schema: {}, options: {} })),
  oAuthDiscoveryMetadata: vi.fn((auth) => {
    return async (_request: Request): Promise<Response> => {
      // Simulate what better-auth returns: RFC 8414 OAuth Authorization Server Metadata
      void auth
      const baseUrl = 'http://localhost:3001'
      return new Response(
        JSON.stringify({
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/api/auth/mcp/authorize`,
          token_endpoint: `${baseUrl}/api/auth/mcp/token`,
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
}))

// Mock better-auth core
vi.mock('better-auth', () => ({
  betterAuth: vi.fn(() => ({
    handler: vi.fn(),
    api: {
      getMcpSession: vi.fn(),
      getMcpOAuthConfig: vi.fn(),
    },
    options: {},
  })),
}))

vi.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: vi.fn(() => ({})),
}))

vi.mock('better-auth/next-js', () => ({
  nextCookies: vi.fn(() => ({ id: 'next-cookies' })),
}))

// Import the route after mocking
const { GET } = await import('../route')

describe('OAuth Authorization Server Discovery Route', () => {
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
})
