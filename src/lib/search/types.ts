/**
 * Result from vector search containing chunk data and video metadata
 */
export interface SearchResult {
  // Chunk data
  chunkId: number;
  content: string;
  startTime: number | null;
  endTime: number | null;
  similarity: number; // 0-1 range, higher is more similar

  // Video metadata
  videoId: number;
  videoTitle: string;
  channel: string;
  youtubeId: string | null;
  thumbnail: string | null;
  publishedAt?: Date | null; // For temporal decay calculations
}
