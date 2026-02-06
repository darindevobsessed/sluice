/**
 * Tests for MCP authentication
 *
 * Tests environment-based auth for MCP endpoints.
 * Auth is disabled by default, enabled via MCP_AUTH_ENABLED=true
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateMcpAuth } from '../auth'

describe('validateMcpAuth', () => {
  // Store original env vars
  const originalEnv = {
    MCP_AUTH_ENABLED: process.env.MCP_AUTH_ENABLED,
    MCP_AUTH_TOKEN: process.env.MCP_AUTH_TOKEN,
  }

  // Clean up after each test
  afterEach(() => {
    process.env.MCP_AUTH_ENABLED = originalEnv.MCP_AUTH_ENABLED
    process.env.MCP_AUTH_TOKEN = originalEnv.MCP_AUTH_TOKEN
  })

  describe('auth disabled (default)', () => {
    beforeEach(() => {
      delete process.env.MCP_AUTH_ENABLED
      delete process.env.MCP_AUTH_TOKEN
    })

    it('allows requests when auth is not enabled', () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        headers: {},
      })

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('allows requests even without authorization header', () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp')

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(true)
    })

    it('allows requests when MCP_AUTH_ENABLED=false', () => {
      process.env.MCP_AUTH_ENABLED = 'false'

      const request = new Request('http://localhost:3000/api/mcp/mcp')

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(true)
    })
  })

  describe('auth enabled', () => {
    const validToken = 'test-secret-token-123'

    beforeEach(() => {
      process.env.MCP_AUTH_ENABLED = 'true'
      process.env.MCP_AUTH_TOKEN = validToken
    })

    it('allows requests with valid Bearer token', () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        headers: {
          'Authorization': `Bearer ${validToken}`,
        },
      })

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('rejects requests with missing authorization header', () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp')

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Missing authorization header')
    })

    it('rejects requests with invalid token', () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        headers: {
          'Authorization': 'Bearer wrong-token',
        },
      })

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid token')
    })

    it('rejects requests with empty token', () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        headers: {
          'Authorization': 'Bearer ',
        },
      })

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid token')
    })

    it('handles Bearer prefix correctly', () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        headers: {
          'Authorization': validToken, // Missing Bearer prefix
        },
      })

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid token')
    })

    it('is case-sensitive for token comparison', () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        headers: {
          'Authorization': `Bearer ${validToken.toUpperCase()}`,
        },
      })

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid token')
    })
  })

  describe('auth enabled but token not configured', () => {
    beforeEach(() => {
      process.env.MCP_AUTH_ENABLED = 'true'
      delete process.env.MCP_AUTH_TOKEN
    })

    it('rejects all requests when MCP_AUTH_TOKEN is not set', () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        headers: {
          'Authorization': 'Bearer some-token',
        },
      })

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('MCP_AUTH_TOKEN not configured')
    })

    it('rejects requests even without auth header when token not configured', () => {
      const request = new Request('http://localhost:3000/api/mcp/mcp')

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('MCP_AUTH_TOKEN not configured')
    })
  })

  describe('edge cases', () => {
    it('handles authorization header with different casing', () => {
      process.env.MCP_AUTH_ENABLED = 'true'
      process.env.MCP_AUTH_TOKEN = 'test-token'

      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        headers: {
          'authorization': 'Bearer test-token', // lowercase header name
        },
      })

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(true)
    })

    it('handles empty string token in env', () => {
      process.env.MCP_AUTH_ENABLED = 'true'
      process.env.MCP_AUTH_TOKEN = ''

      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        headers: {
          'Authorization': 'Bearer ',
        },
      })

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('MCP_AUTH_TOKEN not configured')
    })

    it('handles whitespace in token', () => {
      process.env.MCP_AUTH_ENABLED = 'true'
      process.env.MCP_AUTH_TOKEN = 'token with spaces'

      const request = new Request('http://localhost:3000/api/mcp/mcp', {
        headers: {
          'Authorization': 'Bearer token with spaces',
        },
      })

      const result = validateMcpAuth(request)
      expect(result.valid).toBe(true)
    })
  })
})
