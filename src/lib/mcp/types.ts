/**
 * MCP Tool Types for Gold Miner
 * Defines parameter and response types for Model Context Protocol tools
 */

/**
 * Parameters for the search_rag tool
 */
export interface SearchRagParams {
  /** Search query for the knowledge base */
  topic: string
  /** Optional filter by creator/channel name */
  creator?: string
  /** Optional limit on number of results (default: 10, max: 50) */
  limit?: number
}

/**
 * Individual creator/channel information
 */
export interface Creator {
  /** Channel name */
  channel: string
  /** Number of videos from this channel */
  videoCount: number
}

/**
 * Response from the get_list_of_creators tool
 */
export interface CreatorListResponse {
  /** List of creators with video counts */
  creators: Creator[]
}
