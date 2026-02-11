import type { VideoPageMetadata } from './types'

/**
 * Parse ISO 8601 duration (e.g., PT1H2M3S) to seconds
 * Supports formats: PT1H2M3S, PT30M, PT45S, PT2H
 */
function parseIsoDuration(isoDuration: string): number | null {
  const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)

  if (!match) {
    return null
  }

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Parse dateText format like "Jun 9, 2025" to ISO 8601 string
 */
function parseDateText(dateText: string): string | null {
  try {
    const parsed = new Date(dateText)
    if (isNaN(parsed.getTime())) {
      return null
    }
    return parsed.toISOString()
  } catch {
    return null
  }
}

/**
 * Fetch video page metadata from YouTube
 * Extracts publishedAt, description, and duration from HTML meta tags
 */
export async function fetchVideoPageMetadata(videoId: string): Promise<VideoPageMetadata> {
  const url = `https://www.youtube.com/watch?v=${videoId}`

  let html: string
  try {
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
      },
    })

    if (!response.ok) {
      return {
        publishedAt: null,
        description: null,
        duration: null,
      }
    }

    html = await response.text()
  } catch {
    return {
      publishedAt: null,
      description: null,
      duration: null,
    }
  }

  // Extract publishedAt - primary: meta itemprop datePublished
  let publishedAt: string | null = null
  const datePublishedMatch = html.match(/<meta\s+itemprop="datePublished"\s+content="([^"]+)"/)
  if (datePublishedMatch?.[1]) {
    publishedAt = datePublishedMatch[1]
  } else {
    // Fallback: dateText JSON pattern
    const dateTextMatch = html.match(/"dateText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/)
    if (dateTextMatch?.[1]) {
      publishedAt = parseDateText(dateTextMatch[1])
    }
  }

  // Extract description - primary: meta name="description", fallback: og:description
  let description: string | null = null
  const descriptionMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/)
  if (descriptionMatch?.[1]) {
    description = descriptionMatch[1]
  } else {
    const ogDescriptionMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/)
    if (ogDescriptionMatch?.[1]) {
      description = ogDescriptionMatch[1]
    }
  }

  // Extract duration - meta itemprop duration (ISO 8601 format)
  let duration: number | null = null
  const durationMatch = html.match(/<meta\s+itemprop="duration"\s+content="([^"]+)"/)
  if (durationMatch?.[1]) {
    duration = parseIsoDuration(durationMatch[1])
  }

  return {
    publishedAt,
    description,
    duration,
  }
}
