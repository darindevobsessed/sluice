import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the database to avoid connection issues in tests
vi.mock('@/lib/db', () => ({
  db: {},
}))

// Store original env vars
const originalEnv = {
  MCP_AUTH_ENABLED: process.env.MCP_AUTH_ENABLED,
  MCP_AUTH_TOKEN: process.env.MCP_AUTH_TOKEN,
}

// Import after mocking
const routeModule = await import('../route')

describe('MCP Route Handler', () => {
  // Clean up after each test
  afterEach(() => {
    process.env.MCP_AUTH_ENABLED = originalEnv.MCP_AUTH_ENABLED
    process.env.MCP_AUTH_TOKEN = originalEnv.MCP_AUTH_TOKEN
  })

  it('exports GET handler', () => {
    expect(routeModule.GET).toBeDefined()
    expect(typeof routeModule.GET).toBe('function')
  })

  it('exports POST handler', () => {
    expect(routeModule.POST).toBeDefined()
    expect(typeof routeModule.POST).toBe('function')
  })

  it('GET and POST should be the same handler', () => {
    expect(routeModule.GET).toBe(routeModule.POST)
  })

  it('exports maxDuration config', () => {
    expect(routeModule.maxDuration).toBe(60)
  })

  it('returns a Response for POST requests', async () => {
    const request = new Request('http://localhost:3000/api/mcp/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      }),
    })

    const response = await routeModule.POST(request)
    expect(response).toBeInstanceOf(Response)
    // MCP handler should return 200 for valid initialize request
    expect(response.status).toBe(200)
  }, 10000)

  it('adds Accept header when missing', async () => {
    // Request without Accept header should still work
    // (wrappedHandler adds it before passing to mcp-handler)
    const request = new Request('http://localhost:3000/api/mcp/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      }),
    })

    const response = await routeModule.POST(request)
    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(200)
  }, 10000)

  describe('authentication', () => {
    beforeEach(() => {
      // Ensure auth is disabled for default tests
      delete process.env.MCP_AUTH_ENABLED
      delete process.env.MCP_AUTH_TOKEN
    })

    it('allows requests when auth is disabled (default)', async () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0',
            },
          },
        }),
      })

      const response = await routeModule.POST(request)
      expect(response.status).toBe(200)
    }, 10000)

    it('rejects requests without token when auth is enabled', async () => {
      process.env.MCP_AUTH_ENABLED = 'true'
      process.env.MCP_AUTH_TOKEN = 'test-token-123'

      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0',
            },
          },
        }),
      })

      const response = await routeModule.POST(request)
      expect(response.status).toBe(401)

      const body = await response.json()
      expect(body.error).toBe('Missing authorization header')
    })

    it('rejects requests with invalid token when auth is enabled', async () => {
      process.env.MCP_AUTH_ENABLED = 'true'
      process.env.MCP_AUTH_TOKEN = 'test-token-123'

      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': 'Bearer wrong-token',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0',
            },
          },
        }),
      })

      const response = await routeModule.POST(request)
      expect(response.status).toBe(401)

      const body = await response.json()
      expect(body.error).toBe('Invalid token')
    })

    it('allows requests with valid token when auth is enabled', async () => {
      process.env.MCP_AUTH_ENABLED = 'true'
      process.env.MCP_AUTH_TOKEN = 'test-token-123'

      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': 'Bearer test-token-123',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0',
            },
          },
        }),
      })

      const response = await routeModule.POST(request)
      expect(response.status).toBe(200)
    }, 10000)
  })
})
