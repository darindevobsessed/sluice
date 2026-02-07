import { XMLParser } from 'fast-xml-parser'
import type { RSSFeedResult, RSSVideo } from './types'

export function getFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
}

export async function fetchChannelFeed(
  channelId: string
): Promise<RSSFeedResult> {
  const feedUrl = getFeedUrl(channelId)

  // Fetch the RSS feed
  let response: Response
  try {
    response = await fetch(feedUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to fetch RSS feed: ${message}`)
  }

  // Check response status
  if (!response.ok) {
    throw new Error(
      `RSS feed fetch failed: ${response.status} ${response.statusText}`
    )
  }

  // Get XML text
  const xml = await response.text()

  // Parse XML
  let parsed: unknown
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    })
    parsed = parser.parse(xml)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to parse RSS feed: ${message}`)
  }

  // Extract feed data with type safety
  const feed = parsed as {
    feed?: {
      title?: string
      entry?: unknown | unknown[]
    }
  }

  if (!feed.feed) {
    throw new Error('Failed to parse RSS feed: Invalid feed structure')
  }

  const channelName = typeof feed.feed.title === 'string'
    ? feed.feed.title.trim()
    : 'Unknown Channel'

  // Handle entries (can be single object or array)
  const entries = feed.feed.entry
    ? Array.isArray(feed.feed.entry)
      ? feed.feed.entry
      : [feed.feed.entry]
    : []

  // Parse video entries
  const videos: RSSVideo[] = []

  for (const entry of entries) {
    const video = parseVideoEntry(entry, channelId, channelName)
    if (video) {
      videos.push(video)
    }
  }

  return {
    channelId,
    channelName,
    videos,
    fetchedAt: new Date(),
  }
}

function parseVideoEntry(
  entry: unknown,
  channelId: string,
  channelName: string
): RSSVideo | null {
  // Type guard for entry structure
  const e = entry as {
    'yt:videoId'?: string
    title?: string
    published?: string
    'media:group'?: {
      'media:description'?: string
    }
    author?: {
      name?: string
    }
  }

  // Extract required fields
  const youtubeId = typeof e['yt:videoId'] === 'string'
    ? e['yt:videoId'].trim()
    : null

  const title = typeof e.title === 'string' ? e.title.trim() : null

  const publishedStr = typeof e.published === 'string'
    ? e.published.trim()
    : null

  // Validate required fields
  if (!youtubeId || !title || !publishedStr) {
    return null
  }

  // Parse date
  const publishedAt = new Date(publishedStr)
  if (isNaN(publishedAt.getTime())) {
    // Invalid date
    return null
  }

  // Extract optional description
  const description = typeof e['media:group']?.['media:description'] === 'string'
    ? e['media:group']['media:description'].trim()
    : ''

  // Use provided channel name or fall back to author name
  const videoChannelName = typeof e.author?.name === 'string'
    ? e.author.name.trim()
    : channelName

  return {
    youtubeId,
    title,
    channelId,
    channelName: videoChannelName,
    publishedAt,
    description,
  }
}
