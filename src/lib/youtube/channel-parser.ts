/**
 * YouTube Channel URL Parser
 * Parses various YouTube channel URL formats and extracts the channel ID
 */

/**
 * Extract channel ID from HTML page source
 * Looks for meta tag or externalId in page data
 */
export function extractChannelIdFromHtml(html: string): string | null {
  if (!html || html.trim() === '') {
    return null
  }

  // Try meta tag first: <meta itemprop="identifier" content="UCXXX">
  const metaMatch = html.match(/<meta\s+itemprop="identifier"\s+content="([^"]+)"/)
  if (metaMatch?.[1]) {
    return metaMatch[1]
  }

  // Fallback: look for externalId in page data
  const externalIdMatch = html.match(/"externalId":"([^"]+)"/)
  if (externalIdMatch?.[1]) {
    return externalIdMatch[1]
  }

  return null
}

/**
 * Parse YouTube channel URL and return the channel ID
 * Supports formats:
 * - youtube.com/channel/UCXXX
 * - youtube.com/@handle
 * - youtube.com/c/name
 * - Raw channel ID (UCXXX)
 */
export async function parseChannelUrl(url: string): Promise<string> {
  const trimmed = url.trim()

  if (!trimmed) {
    throw new Error('Invalid channel URL')
  }

  // Check if it's a raw channel ID (starts with UC)
  if (/^UC[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return trimmed
  }

  // Check if it's a bare @handle (no domain)
  const bareHandleMatch = trimmed.match(/^@([a-zA-Z0-9_-]+)$/)
  if (bareHandleMatch?.[1]) {
    // Fetch the channel page to extract channel ID
    const channelPageUrl = `https://www.youtube.com/@${bareHandleMatch[1]}`

    let response: Response
    try {
      response = await fetch(channelPageUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to fetch channel page: ${message}`)
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch channel page: ${response.status} ${response.statusText}`
      )
    }

    const html = await response.text()
    const channelId = extractChannelIdFromHtml(html)

    if (!channelId) {
      throw new Error('Could not extract channel ID from page')
    }

    return channelId
  }

  // Normalize URL - add protocol if missing
  let normalizedUrl = trimmed
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = `https://${normalizedUrl}`
  }

  // Try to parse as URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(normalizedUrl)
  } catch {
    throw new Error('Invalid channel URL')
  }

  // Check for /channel/UCXXX format
  const channelMatch = parsedUrl.pathname.match(/^\/channel\/([^/]+)/)
  if (channelMatch?.[1]) {
    return channelMatch[1]
  }

  // Check for @handle or /c/ format - need to fetch the page
  const handleMatch = parsedUrl.pathname.match(/^\/@([^/]+)/)
  const customMatch = parsedUrl.pathname.match(/^\/c\/([^/]+)/)

  if (handleMatch || customMatch) {
    // Fetch the channel page to extract channel ID
    const channelPageUrl = handleMatch
      ? `https://www.youtube.com/@${handleMatch[1]}`
      : `https://www.youtube.com/c/${customMatch?.[1]}`

    let response: Response
    try {
      response = await fetch(channelPageUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to fetch channel page: ${message}`)
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch channel page: ${response.status} ${response.statusText}`
      )
    }

    const html = await response.text()
    const channelId = extractChannelIdFromHtml(html)

    if (!channelId) {
      throw new Error('Could not extract channel ID from page')
    }

    return channelId
  }

  throw new Error('Invalid channel URL format')
}
