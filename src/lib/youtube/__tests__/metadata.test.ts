import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchVideoPageMetadata } from '../metadata'

describe('fetchVideoPageMetadata', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts publishedAt, description, and duration from meta tags', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta itemprop="datePublished" content="2025-06-09T06:00:15-07:00">
          <meta name="description" content="This is a test video description with some content">
          <meta itemprop="duration" content="PT12M30S">
        </head>
        <body>Video content</body>
      </html>
    `

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    })

    const result = await fetchVideoPageMetadata('dQw4w9WgXcQ')

    expect(result).toEqual({
      publishedAt: '2025-06-09T06:00:15-07:00',
      description: 'This is a test video description with some content',
      duration: 750, // 12*60 + 30 = 750 seconds
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      { headers: { 'Accept-Language': 'en' } }
    )
  })

  it('extracts description from og:description when name="description" is missing', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta itemprop="datePublished" content="2025-06-09T06:00:15-07:00">
          <meta property="og:description" content="Open Graph description content">
          <meta itemprop="duration" content="PT5M45S">
        </head>
      </html>
    `

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    })

    const result = await fetchVideoPageMetadata('test123')

    expect(result.description).toBe('Open Graph description content')
  })

  it('uses dateText fallback when meta itemprop datePublished is missing', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="description" content="Test description">
          <meta itemprop="duration" content="PT1M">
        </head>
        <body>
          <script>
            var ytInitialData = {
              "dateText": {"simpleText": "Jun 9, 2025"}
            };
          </script>
        </body>
      </html>
    `

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    })

    const result = await fetchVideoPageMetadata('test456')

    expect(result.publishedAt).toMatch(/2025-06-09/)
    expect(result.description).toBe('Test description')
  })

  it('returns null for missing fields', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Video</title>
        </head>
      </html>
    `

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    })

    const result = await fetchVideoPageMetadata('missing123')

    expect(result).toEqual({
      publishedAt: null,
      description: null,
      duration: null,
    })
  })

  it('returns all nulls when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await fetchVideoPageMetadata('error123')

    expect(result).toEqual({
      publishedAt: null,
      description: null,
      duration: null,
    })
  })

  it('parses ISO 8601 duration PT1H2M3S correctly', async () => {
    const mockHtml = `
      <meta itemprop="duration" content="PT1H2M3S">
    `

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    })

    const result = await fetchVideoPageMetadata('duration1')

    expect(result.duration).toBe(3723) // 1*3600 + 2*60 + 3 = 3723
  })

  it('parses ISO 8601 duration PT30M correctly', async () => {
    const mockHtml = `
      <meta itemprop="duration" content="PT30M">
    `

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    })

    const result = await fetchVideoPageMetadata('duration2')

    expect(result.duration).toBe(1800) // 30*60 = 1800
  })

  it('parses ISO 8601 duration PT45S correctly', async () => {
    const mockHtml = `
      <meta itemprop="duration" content="PT45S">
    `

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    })

    const result = await fetchVideoPageMetadata('duration3')

    expect(result.duration).toBe(45)
  })

  it('parses ISO 8601 duration PT2H correctly', async () => {
    const mockHtml = `
      <meta itemprop="duration" content="PT2H">
    `

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    })

    const result = await fetchVideoPageMetadata('duration4')

    expect(result.duration).toBe(7200) // 2*3600 = 7200
  })

  it('returns null duration for invalid ISO 8601 format', async () => {
    const mockHtml = `
      <meta itemprop="duration" content="INVALID">
    `

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    })

    const result = await fetchVideoPageMetadata('duration5')

    expect(result.duration).toBe(null)
  })

  it('handles HTTP error responses gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const result = await fetchVideoPageMetadata('notfound')

    expect(result).toEqual({
      publishedAt: null,
      description: null,
      duration: null,
    })
  })
})
