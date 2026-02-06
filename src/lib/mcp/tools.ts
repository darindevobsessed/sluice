import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { hybridSearch } from '@/lib/search/hybrid-search'
import { aggregateByVideo } from '@/lib/search/aggregate'
import { getDistinctChannels } from '@/lib/db/search'

/**
 * Register the search_rag tool with the MCP server.
 *
 * This tool searches the Gold Miner knowledge base for relevant content
 * from YouTube videos. It supports filtering by creator/channel name.
 *
 * @param server - MCP server instance to register the tool with
 */
export function registerSearchRag(server: McpServer): void {
  server.registerTool(
    'search_rag',
    {
      title: 'Search RAG',
      description: 'Search the Gold Miner knowledge base for relevant content from YouTube videos',
      inputSchema: {
        topic: z.string().describe('Search query for the knowledge base'),
        creator: z.string().optional().describe('Filter by creator/channel name'),
        limit: z.number().int().min(1).max(50).default(10).optional().describe('Max results'),
      },
    },
    async ({ topic, creator, limit }) => {
      // Perform hybrid search
      const results = await hybridSearch(topic, { limit: limit ?? 10 })

      // Filter by creator if provided (case-insensitive)
      const filtered = creator
        ? results.filter(r => r.channel.toLowerCase().includes(creator.toLowerCase()))
        : results

      // Aggregate results by video
      const videos = aggregateByVideo(filtered)

      // Return formatted response
      return {
        content: [{ type: 'text', text: JSON.stringify(videos, null, 2) }],
      }
    }
  )
}

/**
 * Register the get_list_of_creators tool with the MCP server.
 *
 * This tool returns all distinct YouTube channels (creators) in the knowledge base
 * with their video counts, sorted by video count descending.
 *
 * @param server - MCP server instance to register the tool with
 */
export function registerGetListOfCreators(server: McpServer): void {
  server.registerTool(
    'get_list_of_creators',
    {
      title: 'Get List of Creators',
      description: 'Returns all distinct YouTube channels (creators) in the knowledge base with video counts',
      inputSchema: {},
    },
    async () => {
      const creators = await getDistinctChannels()
      return {
        content: [{ type: 'text', text: JSON.stringify(creators, null, 2) }],
      }
    }
  )
}
