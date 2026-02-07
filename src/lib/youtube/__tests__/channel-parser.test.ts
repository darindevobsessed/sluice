import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { parseChannelUrl, extractChannelIdFromHtml } from '../channel-parser'

// Mock global fetch
global.fetch = vi.fn()
const mockFetch = vi.mocked(global.fetch)

describe('parseChannelUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('direct channel ID format', () => {
    it('parses youtube.com/channel/UCXXX format', async () => {
      const result = await parseChannelUrl('https://www.youtube.com/channel/UCXuqSBlHAE6Xw-yeJA0Tunw')
      expect(result).toBe('UCXuqSBlHAE6Xw-yeJA0Tunw')
    })

    it('parses youtube.com/channel/UCXXX without protocol', async () => {
      const result = await parseChannelUrl('youtube.com/channel/UCtest123')
      expect(result).toBe('UCtest123')
    })

    it('parses youtube.com/channel/UCXXX with trailing slash', async () => {
      const result = await parseChannelUrl('https://www.youtube.com/channel/UCtest123/')
      expect(result).toBe('UCtest123')
    })

    it('parses youtube.com/channel/UCXXX with query params', async () => {
      const result = await parseChannelUrl('https://www.youtube.com/channel/UCtest123?sub_confirmation=1')
      expect(result).toBe('UCtest123')
    })
  })

  describe('raw channel ID', () => {
    it('accepts raw channel ID starting with UC', async () => {
      const result = await parseChannelUrl('UCXuqSBlHAE6Xw-yeJA0Tunw')
      expect(result).toBe('UCXuqSBlHAE6Xw-yeJA0Tunw')
    })
  })

  describe('@handle format', () => {
    it('parses youtube.com/@handle by fetching channel page', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta itemprop="identifier" content="UCtest123">
          </head>
        </html>
      `
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      } as Response)

      const result = await parseChannelUrl('https://www.youtube.com/@testhandle')
      expect(result).toBe('UCtest123')
      expect(mockFetch).toHaveBeenCalledWith('https://www.youtube.com/@testhandle')
    })

    it('parses @handle without domain by fetching channel page', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta itemprop="identifier" content="UCtest456">
          </head>
        </html>
      `
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      } as Response)

      const result = await parseChannelUrl('@testhandle')
      expect(result).toBe('UCtest456')
    })

    it('handles @handle with externalId in page source', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <script>var ytInitialData = {"externalId":"UCtest789"};</script>
          </body>
        </html>
      `
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      } as Response)

      const result = await parseChannelUrl('https://www.youtube.com/@testhandle')
      expect(result).toBe('UCtest789')
    })

    it('throws error when channel page fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response)

      await expect(parseChannelUrl('@invalidhandle')).rejects.toThrow(
        'Failed to fetch channel page: 404 Not Found'
      )
    })

    it('throws error when channel ID not found in HTML', async () => {
      const mockHtml = '<html><body>No channel ID here</body></html>'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      } as Response)

      await expect(parseChannelUrl('@invalidhandle')).rejects.toThrow(
        'Could not extract channel ID from page'
      )
    })
  })

  describe('/c/ format', () => {
    it('parses youtube.com/c/name by fetching channel page', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta itemprop="identifier" content="UCcustomname123">
          </head>
        </html>
      `
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      } as Response)

      const result = await parseChannelUrl('https://www.youtube.com/c/customname')
      expect(result).toBe('UCcustomname123')
    })

    it('parses /c/ format without protocol', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta itemprop="identifier" content="UCcustomname456">
          </head>
        </html>
      `
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      } as Response)

      const result = await parseChannelUrl('youtube.com/c/customname')
      expect(result).toBe('UCcustomname456')
    })
  })

  describe('edge cases', () => {
    it('throws error for invalid URL format', async () => {
      await expect(parseChannelUrl('not-a-youtube-url')).rejects.toThrow()
    })

    it('throws error for empty string', async () => {
      await expect(parseChannelUrl('')).rejects.toThrow('Invalid channel URL')
    })

    it('throws error for whitespace only', async () => {
      await expect(parseChannelUrl('   ')).rejects.toThrow('Invalid channel URL')
    })

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(parseChannelUrl('@handle')).rejects.toThrow(
        'Failed to fetch channel page: Network error'
      )
    })
  })
})

describe('extractChannelIdFromHtml', () => {
  it('extracts channel ID from meta tag', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta itemprop="identifier" content="UCtest123">
        </head>
      </html>
    `
    const result = extractChannelIdFromHtml(html)
    expect(result).toBe('UCtest123')
  })

  it('extracts channel ID from externalId in script', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <script>var ytInitialData = {"externalId":"UCtest456"};</script>
        </body>
      </html>
    `
    const result = extractChannelIdFromHtml(html)
    expect(result).toBe('UCtest456')
  })

  it('prefers meta tag over externalId when both present', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta itemprop="identifier" content="UCmeta123">
        </head>
        <body>
          <script>var ytInitialData = {"externalId":"UCscript456"};</script>
        </body>
      </html>
    `
    const result = extractChannelIdFromHtml(html)
    expect(result).toBe('UCmeta123')
  })

  it('returns null when channel ID not found', () => {
    const html = '<html><body>No channel ID here</body></html>'
    const result = extractChannelIdFromHtml(html)
    expect(result).toBeNull()
  })

  it('returns null for empty HTML', () => {
    const result = extractChannelIdFromHtml('')
    expect(result).toBeNull()
  })

  it('handles malformed HTML gracefully', () => {
    const html = '<html><meta itemprop="identifier" content="UCtest"><not-closed>'
    const result = extractChannelIdFromHtml(html)
    expect(result).toBe('UCtest')
  })
})
