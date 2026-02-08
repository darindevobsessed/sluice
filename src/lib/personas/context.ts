import { hybridSearch } from '@/lib/search/hybrid-search'
import type { SearchResult } from '@/lib/search/types'

/**
 * Fetches relevant context chunks for a persona query, scoped to the creator's channel.
 *
 * Uses hybrid search (vector + keyword) to find the most relevant content,
 * then filters results to only include chunks from the specified channel.
 *
 * @param channelName - Name of the YouTube channel to scope context to
 * @param question - User's question to find relevant context for
 * @returns Array of up to 10 relevant chunks from the channel
 */
export async function getPersonaContext(
  channelName: string,
  question: string
): Promise<SearchResult[]> {
  // Fetch more results than we need since we'll filter by channel
  const searchResults = await hybridSearch(question, {
    mode: 'hybrid',
    limit: 50, // Fetch extra to ensure we get 10 from the target channel
  })

  // Filter to only include results from the target channel
  const filteredResults = searchResults.filter(
    (result) => result.channel === channelName
  )

  // Return top 10 results
  return filteredResults.slice(0, 10)
}

/**
 * Formats search results as numbered context blocks for inclusion in system prompt.
 *
 * Creates a structured context string with:
 * - Numbered references for each chunk
 * - Source video title
 * - Timestamp (if available)
 * - Chunk content
 *
 * @param results - Search results to format
 * @returns Formatted context string, or empty string if no results
 */
export function formatContextForPrompt(results: SearchResult[]): string {
  if (results.length === 0) {
    return ''
  }

  return results
    .map((result, index) => {
      const number = index + 1
      const timestamp = result.startTime !== null ? `${result.startTime}s` : ''
      const timestampPart = timestamp ? ` (${timestamp})` : ''

      return `[${number}] From "${result.videoTitle}"${timestampPart}:\n${result.content}`
    })
    .join('\n\n')
}
