interface SupadataSegment {
  text: string
  offset: number
  duration: number
  lang: string
}

interface RawTranscriptItem {
  text: string
  duration: number
  offset: number
}

/**
 * Fetch transcript via Supadata API.
 * Works from datacenter IPs (Vercel, AWS) where InnerTube is blocked.
 * https://supadata.ai/docs
 */
export async function fetchTranscriptSupadata(
  videoId: string,
  lang = 'en',
): Promise<RawTranscriptItem[]> {
  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) throw new Error('SUPADATA_API_KEY not set')

  const url = new URL('https://api.supadata.ai/v1/youtube/transcript')
  url.searchParams.set('videoId', videoId)
  url.searchParams.set('lang', lang)

  const response = await fetch(url.toString(), {
    headers: { 'x-api-key': apiKey },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Supadata API error ${response.status}: ${body}`)
  }

  const data = await response.json() as { content: SupadataSegment[] }

  if (!data.content?.length) {
    throw new Error('Supadata returned empty transcript')
  }

  return data.content.map((seg) => ({
    text: seg.text,
    duration: seg.duration / 1000,
    offset: seg.offset / 1000,
  }))
}
