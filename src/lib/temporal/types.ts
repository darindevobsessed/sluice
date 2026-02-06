/**
 * Temporal metadata types for Temporal Graph RAG
 * Represents version mentions and release dates extracted from chunk content
 */

/**
 * Temporal metadata for a single chunk
 * Contains extracted version mentions and release dates with confidence scores
 */
export interface TemporalMetadata {
  chunkId: number
  versionMention: string | null
  releaseDateMention: string | null
  confidence: number
}

/**
 * Result of temporal extraction from chunk content
 * Contains arrays of detected versions and dates with overall confidence
 */
export interface TemporalExtraction {
  versions: string[]
  dates: string[]
  confidence: number
}
