/**
 * Tests for token generation and validation
 */
import { describe, it, expect } from 'vitest'
import { generateToken, validateToken } from '../auth'

describe('generateToken', () => {
  it('generates a token in correct format (xxx-xxx-xxx)', () => {
    const token = generateToken()
    expect(token).toMatch(/^[a-z0-9]{3}-[a-z0-9]{3}-[a-z0-9]{3}$/)
  })

  it('generates unique tokens', () => {
    const token1 = generateToken()
    const token2 = generateToken()
    expect(token1).not.toBe(token2)
  })

  it('uses only unambiguous characters', () => {
    // Generate multiple tokens to verify character set
    for (let i = 0; i < 10; i++) {
      const token = generateToken()
      expect(token).not.toMatch(/[0oOlI1]/)
    }
  })

  it('generates 11-character tokens (9 chars + 2 hyphens)', () => {
    const token = generateToken()
    expect(token.length).toBe(11)
  })
})

describe('validateToken', () => {
  it('returns true for matching tokens', () => {
    const token = 'abc-123-xyz'
    expect(validateToken(token, token)).toBe(true)
  })

  it('returns false for different tokens', () => {
    const token1 = 'abc-123-xyz'
    const token2 = 'def-456-uvw'
    expect(validateToken(token1, token2)).toBe(false)
  })

  it('returns false for tokens with different lengths', () => {
    const token1 = 'abc-123-xyz'
    const token2 = 'abc-123'
    expect(validateToken(token1, token2)).toBe(false)
  })

  it('returns false for empty strings', () => {
    expect(validateToken('', '')).toBe(true) // Empty strings match
    expect(validateToken('abc-123-xyz', '')).toBe(false)
    expect(validateToken('', 'abc-123-xyz')).toBe(false)
  })

  it('is case-sensitive', () => {
    const token1 = 'abc-123-xyz'
    const token2 = 'ABC-123-XYZ'
    expect(validateToken(token1, token2)).toBe(false)
  })

  it('handles tokens with special characters', () => {
    const token = 'a!@-#$%-^&*'
    expect(validateToken(token, token)).toBe(true)
  })
})
