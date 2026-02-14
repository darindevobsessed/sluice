import { describe, it, expect } from 'vitest'
import { buildReturnTo, parseReturnTo, getReturnLabel } from '../navigation'

describe('buildReturnTo', () => {
  it('encodes discovery URL with channel and type filters', () => {
    const pathname = '/discovery'
    const searchParams = new URLSearchParams('channel=abc&type=not-saved')
    const result = buildReturnTo(pathname, searchParams)
    const decoded = decodeURIComponent(result)

    expect(decoded).toBe('/discovery?channel=abc&type=not-saved')
  })

  it('encodes KB URL with search and type filters', () => {
    const pathname = '/'
    const searchParams = new URLSearchParams('q=react&type=youtube')
    const result = buildReturnTo(pathname, searchParams)
    const decoded = decodeURIComponent(result)

    expect(decoded).toBe('/?q=react&type=youtube')
  })

  it('returns empty string for bare KB (no filters)', () => {
    const pathname = '/'
    const searchParams = new URLSearchParams()
    const result = buildReturnTo(pathname, searchParams)

    expect(result).toBe('')
  })

  it('handles complex query params with special characters', () => {
    const pathname = '/discovery'
    const searchParams = new URLSearchParams('channel=Testing+%26+More&type=not-saved')
    const result = buildReturnTo(pathname, searchParams)
    const decoded = decodeURIComponent(result)

    expect(decoded).toContain('/discovery?')
    expect(decoded).toContain('channel=Testing+%26+More')
  })

  it('returns empty string for root path with empty params', () => {
    const pathname = '/'
    const searchParams = new URLSearchParams('')
    const result = buildReturnTo(pathname, searchParams)

    expect(result).toBe('')
  })
})

describe('parseReturnTo', () => {
  it('decodes a valid encoded discovery URL', () => {
    const encoded = encodeURIComponent('/discovery?channel=abc&type=not-saved')
    const result = parseReturnTo(encoded)

    expect(result).toBe('/discovery?channel=abc&type=not-saved')
  })

  it('decodes a valid encoded KB URL', () => {
    const encoded = encodeURIComponent('/?q=react&type=youtube')
    const result = parseReturnTo(encoded)

    expect(result).toBe('/?q=react&type=youtube')
  })

  it('returns null for null input', () => {
    const result = parseReturnTo(null)

    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = parseReturnTo('')

    expect(result).toBeNull()
  })

  it('returns null for external URL (open redirect prevention)', () => {
    const result = parseReturnTo('https://evil.com/phishing')

    expect(result).toBeNull()
  })

  it('returns null for protocol-relative URL (open redirect prevention)', () => {
    const result = parseReturnTo('//evil.com/phishing')

    expect(result).toBeNull()
  })

  it('returns null for malformed input that does not start with /', () => {
    const result = parseReturnTo('discovery?channel=abc')

    expect(result).toBeNull()
  })

  it('handles encoded URLs that start with / after decoding', () => {
    const encoded = encodeURIComponent('/videos/123')
    const result = parseReturnTo(encoded)

    expect(result).toBe('/videos/123')
  })

  it('rejects URL with only ? (no pathname)', () => {
    const result = parseReturnTo('?q=test')

    expect(result).toBeNull()
  })
})

describe('getReturnLabel', () => {
  it('returns "Back to Discovery" for discovery URL', () => {
    const returnTo = '/discovery?channel=abc&type=not-saved'
    const result = getReturnLabel(returnTo)

    expect(result).toEqual({
      href: '/discovery?channel=abc&type=not-saved',
      label: 'Back to Discovery',
    })
  })

  it('returns "Back to Discovery" for discovery URL without query params', () => {
    const returnTo = '/discovery'
    const result = getReturnLabel(returnTo)

    expect(result).toEqual({
      href: '/discovery',
      label: 'Back to Discovery',
    })
  })

  it('returns "Back to Knowledge Bank" for KB URL with filters', () => {
    const returnTo = '/?q=react&type=youtube'
    const result = getReturnLabel(returnTo)

    expect(result).toEqual({
      href: '/?q=react&type=youtube',
      label: 'Back to Knowledge Bank',
    })
  })

  it('returns "Browse Knowledge Bank" for null returnTo (default)', () => {
    const result = getReturnLabel(null)

    expect(result).toEqual({
      href: '/',
      label: 'Browse Knowledge Bank',
    })
  })

  it('returns "Browse Knowledge Bank" for bare KB URL', () => {
    const returnTo = '/'
    const result = getReturnLabel(returnTo)

    expect(result).toEqual({
      href: '/',
      label: 'Browse Knowledge Bank',
    })
  })

  it('returns "Back to Knowledge Bank" for video detail with returnTo', () => {
    const returnTo = '/videos/123'
    const result = getReturnLabel(returnTo)

    expect(result).toEqual({
      href: '/videos/123',
      label: 'Back to Knowledge Bank',
    })
  })

  it('handles discovery subpaths correctly', () => {
    const returnTo = '/discovery/something?channel=test'
    const result = getReturnLabel(returnTo)

    expect(result).toEqual({
      href: '/discovery/something?channel=test',
      label: 'Back to Discovery',
    })
  })
})
