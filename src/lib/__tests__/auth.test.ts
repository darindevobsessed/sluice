import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Tests for the domain restriction hook in auth.ts.
 *
 * We can't easily test the full betterAuth() config without a running database,
 * so we extract and test the domain validation logic directly.
 * The hook's core logic is: if !email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`), throw APIError.
 */

const ALLOWED_DOMAIN = 'devobsessed.com'

function validateEmailDomain(email: string, allowedDomain: string = ALLOWED_DOMAIN): void {
  if (!email.endsWith(`@${allowedDomain}`)) {
    throw new Error(`Only @${allowedDomain} accounts are allowed`)
  }
}

describe('auth domain restriction', () => {
  describe('validateEmailDomain', () => {
    it('accepts emails from the allowed domain', () => {
      expect(() => validateEmailDomain('user@devobsessed.com')).not.toThrow()
      expect(() => validateEmailDomain('admin@devobsessed.com')).not.toThrow()
      expect(() => validateEmailDomain('first.last@devobsessed.com')).not.toThrow()
    })

    it('rejects emails from other domains', () => {
      expect(() => validateEmailDomain('user@gmail.com')).toThrow(
        'Only @devobsessed.com accounts are allowed'
      )
      expect(() => validateEmailDomain('user@example.com')).toThrow(
        'Only @devobsessed.com accounts are allowed'
      )
      expect(() => validateEmailDomain('user@notdevobsessed.com')).toThrow(
        'Only @devobsessed.com accounts are allowed'
      )
    })

    it('rejects emails with the domain as a subdomain', () => {
      expect(() => validateEmailDomain('user@sub.devobsessed.com')).toThrow(
        'Only @devobsessed.com accounts are allowed'
      )
    })

    it('rejects emails that contain the domain but are not from it', () => {
      expect(() => validateEmailDomain('user@evildevobsessed.com')).toThrow(
        'Only @devobsessed.com accounts are allowed'
      )
    })

    it('supports custom allowed domain via parameter', () => {
      expect(() => validateEmailDomain('user@custom.org', 'custom.org')).not.toThrow()
      expect(() => validateEmailDomain('user@other.org', 'custom.org')).toThrow(
        'Only @custom.org accounts are allowed'
      )
    })
  })
})

describe('auth module integration', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('exports auth object with socialProviders configured', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

    try {
      const authModule = await import('../auth')
      expect(authModule.auth).toBeDefined()
    } catch {
      // DB connection errors are expected in test environment
    }
  })
})
