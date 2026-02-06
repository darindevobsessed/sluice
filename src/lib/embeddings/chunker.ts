import type { TranscriptSegment, ChunkData } from './types';

export const TARGET_CHUNK_SIZE = 2000; // characters
export const CHUNK_OVERLAP = 100; // characters

/**
 * Chunk transcript segments into smaller pieces optimized for embedding,
 * preserving timestamps and ensuring semantic boundaries.
 */
export function chunkTranscript(segments: TranscriptSegment[]): ChunkData[] {
  // Filter out empty segments
  const validSegments = segments
    .map((segment, index) => ({ segment, originalIndex: index }))
    .filter(({ segment }) => segment.text.trim().length > 0);

  if (validSegments.length === 0) {
    return [];
  }

  const chunks: ChunkData[] = [];
  let currentChunk = '';
  let currentStartTime = validSegments[0]!.segment.offset;
  let currentEndTime = validSegments[0]!.segment.offset;
  let currentSegmentIndices: number[] = [];
  let overlapText = '';

  for (let i = 0; i < validSegments.length; i++) {
    const { segment, originalIndex } = validSegments[i]!;
    const text = segment.text.trim();

    // Handle very long single segment that needs splitting
    if (text.length > TARGET_CHUNK_SIZE) {
      // If we have accumulated content, finalize it first
      if (currentChunk.length > 0) {
        chunks.push({
          content: currentChunk,
          startTime: currentStartTime,
          endTime: currentEndTime,
          segmentIndices: currentSegmentIndices,
        });

        // Prepare overlap for next chunk
        overlapText = currentChunk.slice(-CHUNK_OVERLAP);
        currentChunk = '';
        currentSegmentIndices = [];
      }

      // Split the long segment
      const subChunks = splitLongText(text, segment.offset, originalIndex);
      chunks.push(...subChunks);

      // Set overlap from last subchunk
      const lastSubChunk = subChunks[subChunks.length - 1];
      if (lastSubChunk) {
        overlapText = lastSubChunk.content.slice(-CHUNK_OVERLAP);
      }

      // Reset for next segment
      currentStartTime = segment.offset;
      currentEndTime = segment.offset;
      continue;
    }

    // Add space between segments if not first
    const separator = currentChunk.length > 0 ? ' ' : '';
    const potentialChunk = currentChunk + separator + text;

    // Check if adding this segment would exceed target size
    if (potentialChunk.length > TARGET_CHUNK_SIZE && currentChunk.length > 0) {
      // Finalize current chunk
      chunks.push({
        content: currentChunk,
        startTime: currentStartTime,
        endTime: currentEndTime,
        segmentIndices: currentSegmentIndices,
      });

      // Start new chunk with overlap
      overlapText = currentChunk.slice(-CHUNK_OVERLAP);
      currentChunk = overlapText + (overlapText.length > 0 ? ' ' : '') + text;
      currentStartTime = segment.offset;
      currentEndTime = segment.offset;
      currentSegmentIndices = [originalIndex];
    } else {
      // Add to current chunk
      if (currentChunk.length === 0) {
        currentChunk = overlapText.length > 0 ? overlapText + ' ' + text : text;
        currentStartTime = segment.offset;
      } else {
        currentChunk = potentialChunk;
      }
      currentEndTime = segment.offset;
      currentSegmentIndices.push(originalIndex);
    }
  }

  // Add final chunk if there's content
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk,
      startTime: currentStartTime,
      endTime: currentEndTime,
      segmentIndices: currentSegmentIndices,
    });
  }

  return chunks;
}

/**
 * Split a very long text into multiple chunks at sentence or word boundaries
 */
function splitLongText(
  text: string,
  offset: number,
  segmentIndex: number
): ChunkData[] {
  const chunks: ChunkData[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let chunkSize = TARGET_CHUNK_SIZE;
    let chunkText = '';

    if (remaining.length <= TARGET_CHUNK_SIZE) {
      // Last chunk
      chunkText = remaining;
      remaining = '';
    } else {
      // Try to break at sentence boundary
      const searchText = remaining.slice(0, TARGET_CHUNK_SIZE + 100);
      const sentenceMatch = searchText.match(/[.!?]\s/g);

      if (sentenceMatch) {
        // Find last sentence boundary within target size
        let lastBoundary = -1;
        let pos = 0;

        for (const match of sentenceMatch) {
          const matchPos = searchText.indexOf(match, pos);
          if (matchPos !== -1 && matchPos <= TARGET_CHUNK_SIZE) {
            lastBoundary = matchPos + match.length;
            pos = matchPos + 1;
          }
        }

        if (lastBoundary > 0) {
          chunkSize = lastBoundary;
        } else {
          // No sentence boundary in range, try word boundary
          chunkSize = findWordBoundary(remaining, TARGET_CHUNK_SIZE);
        }
      } else {
        // No sentence boundary, try word boundary
        chunkSize = findWordBoundary(remaining, TARGET_CHUNK_SIZE);
      }

      chunkText = remaining.slice(0, chunkSize).trim();
      remaining = remaining.slice(chunkSize);

      // Add overlap if there's more content
      if (remaining.length > 0) {
        const overlap = chunkText.slice(-CHUNK_OVERLAP);
        remaining = overlap + remaining;
      }
    }

    if (chunkText.length > 0) {
      chunks.push({
        content: chunkText,
        startTime: offset,
        endTime: offset,
        segmentIndices: [segmentIndex],
      });
    }
  }

  return chunks;
}

/**
 * Find the nearest word boundary before or at the target position
 */
function findWordBoundary(text: string, targetPos: number): number {
  if (targetPos >= text.length) {
    return text.length;
  }

  // Look backwards from target position for a space
  for (let i = targetPos; i > targetPos - 100 && i > 0; i--) {
    if (text[i] === ' ' || text[i] === '\n') {
      return i + 1;
    }
  }

  // If no space found, just break at target
  return targetPos;
}
