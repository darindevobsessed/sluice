import type { SearchResult } from './types';

/**
 * Aggregated search result by video
 */
export interface VideoResult {
  videoId: number;
  youtubeId: string | null;
  title: string;
  channel: string | null;
  thumbnail: string | null;
  publishedAt?: Date | null; // Video publication date for freshness badge
  score: number; // Aggregated score (max of all chunks)
  matchedChunks: number; // Count of matching chunks
  bestChunk: {
    // Highest scoring chunk
    content: string;
    startTime: number | null;
    similarity: number;
  };
}

/**
 * Aggregates chunk-level search results by video.
 *
 * For each video:
 * - Groups all matching chunks together
 * - Counts the number of matched chunks
 * - Uses the maximum chunk score as the video score
 * - Stores the highest-scoring chunk as the "best chunk"
 *
 * Results are sorted by score in descending order (highest scoring videos first).
 *
 * @param chunks - Array of chunk-level search results
 * @returns Array of video-level results sorted by score (descending)
 */
export function aggregateByVideo(chunks: SearchResult[]): VideoResult[] {
  const videoMap = new Map<number, VideoResult>();

  for (const chunk of chunks) {
    const existing = videoMap.get(chunk.videoId);
    if (existing) {
      existing.matchedChunks++;
      // Keep highest scoring chunk
      if (chunk.similarity > existing.bestChunk.similarity) {
        existing.bestChunk = {
          content: chunk.content,
          startTime: chunk.startTime,
          similarity: chunk.similarity,
        };
      }
      // Video score = max chunk score
      existing.score = Math.max(existing.score, chunk.similarity);
    } else {
      videoMap.set(chunk.videoId, {
        videoId: chunk.videoId,
        youtubeId: chunk.youtubeId,
        title: chunk.videoTitle,
        channel: chunk.channel,
        thumbnail: chunk.thumbnail,
        publishedAt: chunk.publishedAt,
        score: chunk.similarity,
        matchedChunks: 1,
        bestChunk: {
          content: chunk.content,
          startTime: chunk.startTime,
          similarity: chunk.similarity,
        },
      });
    }
  }

  return Array.from(videoMap.values()).sort((a, b) => b.score - a.score);
}
