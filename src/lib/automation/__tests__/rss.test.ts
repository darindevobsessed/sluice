import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchChannelFeed, getFeedUrl } from '../rss'

// Mock the global fetch
global.fetch = vi.fn()

const mockFetch = vi.mocked(global.fetch)

describe('getFeedUrl', () => {
  it('returns correct YouTube RSS feed URL', () => {
    const channelId = 'UCXuqSBlHAE6Xw-yeJA0Tunw'
    const expected = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    expect(getFeedUrl(channelId)).toBe(expected)
  })
})

describe('fetchChannelFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('successfully parses a valid RSS feed', async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Test Channel</title>
  <entry>
    <yt:videoId>video123</yt:videoId>
    <title>Test Video 1</title>
    <published>2026-01-15T12:00:00+00:00</published>
    <media:group>
      <media:description>Test description 1</media:description>
    </media:group>
    <author>
      <name>Test Channel</name>
      <uri>https://www.youtube.com/channel/UCtest123</uri>
    </author>
  </entry>
  <entry>
    <yt:videoId>video456</yt:videoId>
    <title>Test Video 2</title>
    <published>2026-01-14T10:30:00+00:00</published>
    <media:group>
      <media:description>Test description 2</media:description>
    </media:group>
    <author>
      <name>Test Channel</name>
      <uri>https://www.youtube.com/channel/UCtest123</uri>
    </author>
  </entry>
</feed>`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockXml,
    } as Response)

    const result = await fetchChannelFeed('UCtest123')

    expect(result.channelId).toBe('UCtest123')
    expect(result.channelName).toBe('Test Channel')
    expect(result.videos).toHaveLength(2)
    expect(result.fetchedAt).toBeInstanceOf(Date)

    expect(result.videos[0]).toEqual({
      youtubeId: 'video123',
      title: 'Test Video 1',
      channelId: 'UCtest123',
      channelName: 'Test Channel',
      publishedAt: new Date('2026-01-15T12:00:00+00:00'),
      description: 'Test description 1',
    })

    expect(result.videos[1]).toEqual({
      youtubeId: 'video456',
      title: 'Test Video 2',
      channelId: 'UCtest123',
      channelName: 'Test Channel',
      publishedAt: new Date('2026-01-14T10:30:00+00:00'),
      description: 'Test description 2',
    })
  })

  it('handles empty feed with no entries', async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Empty Channel</title>
</feed>`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockXml,
    } as Response)

    const result = await fetchChannelFeed('UCempty')

    expect(result.channelId).toBe('UCempty')
    expect(result.channelName).toBe('Empty Channel')
    expect(result.videos).toEqual([])
  })

  it('handles fetch network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await expect(fetchChannelFeed('UCtest123')).rejects.toThrow(
      'Failed to fetch RSS feed: Network error'
    )
  })

  it('handles non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '',
    } as Response)

    await expect(fetchChannelFeed('UCinvalid')).rejects.toThrow(
      'RSS feed fetch failed: 404 Not Found'
    )
  })

  it('handles invalid XML', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'Not valid XML at all',
    } as Response)

    await expect(fetchChannelFeed('UCtest123')).rejects.toThrow(
      'Failed to parse RSS feed'
    )
  })

  it('handles malformed XML with missing required fields', async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Broken Channel</title>
  <entry>
    <title>Video without ID</title>
  </entry>
</feed>`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockXml,
    } as Response)

    const result = await fetchChannelFeed('UCbroken')

    // Should skip entries without required fields
    expect(result.videos).toEqual([])
  })

  it('handles missing description gracefully', async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Test Channel</title>
  <entry>
    <yt:videoId>video789</yt:videoId>
    <title>Video without description</title>
    <published>2026-01-15T12:00:00+00:00</published>
    <author>
      <name>Test Channel</name>
      <uri>https://www.youtube.com/channel/UCtest123</uri>
    </author>
  </entry>
</feed>`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockXml,
    } as Response)

    const result = await fetchChannelFeed('UCtest123')

    expect(result.videos).toHaveLength(1)
    expect(result.videos[0]?.description).toBe('')
  })

  it('handles invalid date format', async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Test Channel</title>
  <entry>
    <yt:videoId>video999</yt:videoId>
    <title>Video with bad date</title>
    <published>not a date</published>
    <media:group>
      <media:description>Test</media:description>
    </media:group>
    <author>
      <name>Test Channel</name>
      <uri>https://www.youtube.com/channel/UCtest123</uri>
    </author>
  </entry>
</feed>`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockXml,
    } as Response)

    const result = await fetchChannelFeed('UCtest123')

    // Should skip entries with invalid dates
    expect(result.videos).toEqual([])
  })

  it('correctly extracts channel ID from author URI', async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Channel Name</title>
  <entry>
    <yt:videoId>vid1</yt:videoId>
    <title>Video</title>
    <published>2026-01-15T12:00:00+00:00</published>
    <media:group>
      <media:description>Desc</media:description>
    </media:group>
    <author>
      <name>Channel Name</name>
      <uri>https://www.youtube.com/channel/UCextracted456</uri>
    </author>
  </entry>
</feed>`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockXml,
    } as Response)

    const result = await fetchChannelFeed('UCoriginal123')

    // Should use the provided channelId parameter, not extract from URI
    expect(result.channelId).toBe('UCoriginal123')
    expect(result.videos[0]?.channelId).toBe('UCoriginal123')
  })

  it('trims whitespace from text fields', async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>  Test Channel  </title>
  <entry>
    <yt:videoId>  video111  </yt:videoId>
    <title>  Test Video  </title>
    <published>2026-01-15T12:00:00+00:00</published>
    <media:group>
      <media:description>  Test description  </media:description>
    </media:group>
    <author>
      <name>  Test Channel  </name>
      <uri>https://www.youtube.com/channel/UCtest123</uri>
    </author>
  </entry>
</feed>`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockXml,
    } as Response)

    const result = await fetchChannelFeed('UCtest123')

    expect(result.channelName).toBe('Test Channel')
    expect(result.videos[0]?.youtubeId).toBe('video111')
    expect(result.videos[0]?.title).toBe('Test Video')
    expect(result.videos[0]?.description).toBe('Test description')
    expect(result.videos[0]?.channelName).toBe('Test Channel')
  })
})
