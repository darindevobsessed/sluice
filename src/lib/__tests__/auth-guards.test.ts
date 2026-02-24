import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { verifyCronSecret, safeCompare } from '../auth-guards'

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
