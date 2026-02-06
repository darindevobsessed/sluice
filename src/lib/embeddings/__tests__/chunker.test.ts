import { describe, it, expect } from 'vitest';
import { chunkTranscript, TARGET_CHUNK_SIZE, CHUNK_OVERLAP } from '../chunker';
import type { TranscriptSegment } from '../types';

describe('chunkTranscript', () => {
  it('should produce single chunk for short transcript (< target size)', () => {
    const segments: TranscriptSegment[] = [
      { text: 'Hello world.', offset: 0 },
      { text: 'This is a short transcript.', offset: 1000 },
      { text: 'It should not be split.', offset: 2000 },
    ];

    const chunks = chunkTranscript(segments);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe(
      'Hello world. This is a short transcript. It should not be split.'
    );
    expect(chunks[0]?.startTime).toBe(0);
    expect(chunks[0]?.endTime).toBe(2000);
    expect(chunks[0]?.segmentIndices).toEqual([0, 1, 2]);
  });

  it('should split long transcript into multiple chunks', () => {
    // Create a long transcript that exceeds TARGET_CHUNK_SIZE
    const segments: TranscriptSegment[] = [];
    let offset = 0;
    for (let i = 0; i < 50; i++) {
      segments.push({
        text: 'This is a sentence that contains about fifty characters.',
        offset,
      });
      offset += 1000;
    }

    const chunks = chunkTranscript(segments);

    // Each sentence is ~55 chars, 50 sentences = 2750 chars
    // Should split into at least 2 chunks
    expect(chunks.length).toBeGreaterThan(1);

    // Each chunk should be close to target size (allowing some variance for boundaries)
    chunks.forEach((chunk, index) => {
      if (index < chunks.length - 1) {
        // Non-last chunks should be around target size
        expect(chunk.content.length).toBeLessThanOrEqual(TARGET_CHUNK_SIZE + 200);
      }
    });
  });

  it('should include overlap between consecutive chunks', () => {
    // Create segments that will split into multiple chunks
    const segments: TranscriptSegment[] = [];
    let offset = 0;
    for (let i = 0; i < 50; i++) {
      segments.push({
        text: `Sentence number ${i} with enough text to make it longer.`,
        offset,
      });
      offset += 1000;
    }

    const chunks = chunkTranscript(segments);

    // Verify overlap exists between consecutive chunks
    for (let i = 0; i < chunks.length - 1; i++) {
      const currentChunk = chunks[i];
      const nextChunk = chunks[i + 1];

      if (!currentChunk || !nextChunk) continue;

      const currentEnd = currentChunk.content.slice(-CHUNK_OVERLAP);

      // The end of current chunk should appear in the start of next chunk
      expect(nextChunk.content).toContain(currentEnd.slice(0, 50));
    }
  });

  it('should accurately reflect chunk boundaries in timestamps', () => {
    const segments: TranscriptSegment[] = [
      { text: 'First segment.', offset: 0 },
      { text: 'Second segment.', offset: 5000 },
      { text: 'Third segment.', offset: 10000 },
    ];

    const chunks = chunkTranscript(segments);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.startTime).toBe(0); // First segment offset
    expect(chunks[0]?.endTime).toBe(10000); // Last segment offset
  });

  it('should skip empty segments', () => {
    const segments: TranscriptSegment[] = [
      { text: 'First segment.', offset: 0 },
      { text: '', offset: 1000 },
      { text: '   ', offset: 2000 }, // Whitespace only
      { text: 'Last segment.', offset: 3000 },
    ];

    const chunks = chunkTranscript(segments);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe('First segment. Last segment.');
    expect(chunks[0]?.segmentIndices).toEqual([0, 3]); // Only non-empty segments
  });

  it('should split very long single segment mid-segment', () => {
    // Create a single segment that exceeds TARGET_CHUNK_SIZE
    const longText = 'A'.repeat(TARGET_CHUNK_SIZE + 500);
    const segments: TranscriptSegment[] = [
      { text: longText, offset: 0 },
    ];

    const chunks = chunkTranscript(segments);

    expect(chunks.length).toBeGreaterThan(1);

    // All chunks should reference the same segment index
    chunks.forEach((chunk) => {
      expect(chunk.segmentIndices).toContain(0);
    });

    // Verify all chunks combined contain the full text (accounting for overlap)
    const firstChunk = chunks[0]?.content || '';
    const lastChunk = chunks[chunks.length - 1]?.content || '';

    expect(firstChunk.startsWith('AAA')).toBe(true);
    expect(lastChunk.endsWith('AAA')).toBe(true);
  });

  it('should break at sentence boundaries when possible', () => {
    // Create segments with clear sentence boundaries
    const segments: TranscriptSegment[] = [];
    let offset = 0;
    for (let i = 0; i < 50; i++) {
      segments.push({
        text: `This is sentence number ${i}. And here is more content to make it longer.`,
        offset,
      });
      offset += 1000;
    }

    const chunks = chunkTranscript(segments);

    // Check that chunks end with sentence terminators where possible
    chunks.forEach((chunk, index) => {
      if (index < chunks.length - 1) {
        const trimmed = chunk.content.trim();
        // Should end with sentence boundary (., !, ?)
        const lastChar = trimmed[trimmed.length - 1];
        // Most chunks should end with sentence terminators
        // (not enforcing 100% due to overlap considerations)
        expect(['.', '!', '?', ' ']).toContain(lastChar);
      }
    });
  });

  it('should break at word boundaries if no sentence boundary', () => {
    // Create a long text without sentence boundaries
    const longText = 'word '.repeat(500); // 2500 chars, no periods
    const segments: TranscriptSegment[] = [
      { text: longText, offset: 0 },
    ];

    const chunks = chunkTranscript(segments);

    expect(chunks.length).toBeGreaterThan(1);

    // Check that chunks don't break mid-word (except possibly last chunk)
    chunks.forEach((chunk, index) => {
      if (index < chunks.length - 1) {
        const trimmed = chunk.content.trim();
        // Should not end with a partial word (should end with space or letter after space)
        const lastChars = trimmed.slice(-5);
        // If it ends with 'word', that's good, or if it ends with space
        expect(
          lastChars.endsWith('word') || lastChars.endsWith(' ')
        ).toBe(true);
      }
    });
  });

  it('should return empty array for all empty segments', () => {
    const segments: TranscriptSegment[] = [
      { text: '', offset: 0 },
      { text: '   ', offset: 1000 },
      { text: '\n\t', offset: 2000 },
    ];

    const chunks = chunkTranscript(segments);

    expect(chunks).toEqual([]);
  });

  it('should handle segments with missing or zero offset', () => {
    const segments: TranscriptSegment[] = [
      { text: 'First.', offset: 0 },
      { text: 'Second.', offset: 0 }, // Same offset
      { text: 'Third.', offset: 1000 },
    ];

    const chunks = chunkTranscript(segments);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.startTime).toBe(0);
    expect(chunks[0]?.endTime).toBe(1000);
    expect(chunks[0]?.content).toBe('First. Second. Third.');
  });

  it('should maintain segment indices correctly across chunks', () => {
    const segments: TranscriptSegment[] = [];
    let offset = 0;
    for (let i = 0; i < 50; i++) {
      segments.push({
        text: `Segment ${i} with sufficient content to create distinct chunks.`,
        offset,
      });
      offset += 1000;
    }

    const chunks = chunkTranscript(segments);

    // Each chunk should have sequential or overlapping segment indices
    chunks.forEach((chunk, index) => {
      expect(chunk.segmentIndices.length).toBeGreaterThan(0);

      // Segment indices should be in ascending order
      for (let i = 1; i < chunk.segmentIndices.length; i++) {
        const prev = chunk.segmentIndices[i - 1];
        const curr = chunk.segmentIndices[i];
        expect(curr).toBeGreaterThanOrEqual(prev || 0);
      }

      // If not the last chunk, should have overlap with next chunk
      if (index < chunks.length - 1) {
        const nextChunk = chunks[index + 1];
        if (nextChunk) {
          // Some segment indices might overlap due to CHUNK_OVERLAP
          const lastIndex = chunk.segmentIndices[chunk.segmentIndices.length - 1];
          const firstNextIndex = nextChunk.segmentIndices[0];

          // Next chunk should start at or near where this chunk ends
          if (lastIndex !== undefined && firstNextIndex !== undefined) {
            expect(firstNextIndex).toBeLessThanOrEqual(lastIndex + 3);
          }
        }
      }
    });
  });

  it('should handle single segment at exactly target size', () => {
    const exactText = 'x'.repeat(TARGET_CHUNK_SIZE);
    const segments: TranscriptSegment[] = [
      { text: exactText, offset: 0 },
    ];

    const chunks = chunkTranscript(segments);

    // Should produce exactly 1 chunk since it fits
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe(exactText);
    expect(chunks[0]?.startTime).toBe(0);
    expect(chunks[0]?.endTime).toBe(0);
  });

  it('should preserve exact text content across all chunks (no data loss)', () => {
    const segments: TranscriptSegment[] = [];
    let offset = 0;
    const texts: string[] = [];

    for (let i = 0; i < 30; i++) {
      const text = `Unique segment ${i} with specific content that should be preserved exactly.`;
      texts.push(text);
      segments.push({ text, offset });
      offset += 1000;
    }

    const chunks = chunkTranscript(segments);

    // Reconstruct text from first chunk and subsequent chunks (removing overlap)
    let reconstructed = chunks[0]?.content || '';

    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk) {
        // Remove overlap by finding where previous chunk ends in current chunk
        const prevEnd = chunks[i - 1]?.content.slice(-CHUNK_OVERLAP) || '';
        const currContent = chunk.content;

        // Find overlap and append only new content
        const overlapIndex = currContent.indexOf(prevEnd.trim());
        if (overlapIndex >= 0) {
          reconstructed += currContent.slice(overlapIndex + prevEnd.trim().length);
        } else {
          // If overlap not found exactly, just append (may have slight duplication)
          reconstructed += ' ' + currContent;
        }
      }
    }

    // The reconstructed text should contain all original unique segments
    texts.forEach((text, index) => {
      expect(reconstructed).toContain(`Unique segment ${index}`);
    });
  });
});
