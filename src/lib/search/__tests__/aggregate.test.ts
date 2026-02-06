import { describe, it, expect } from 'vitest';
import { aggregateByVideo } from '../aggregate';
import type { SearchResult } from '../types';

describe('aggregateByVideo', () => {
  it('aggregates single chunk per video', () => {
    const chunks: SearchResult[] = [
      {
        chunkId: 1,
        content: 'TypeScript is great',
        startTime: 0,
        endTime: 10,
        similarity: 0.9,
        videoId: 1,
        videoTitle: 'TypeScript Basics',
        channel: 'Dev Channel',
        youtubeId: 'abc123',
        thumbnail: 'https://example.com/thumb.jpg',
      },
    ];

    const results = aggregateByVideo(chunks);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      videoId: 1,
      youtubeId: 'abc123',
      title: 'TypeScript Basics',
      channel: 'Dev Channel',
      thumbnail: 'https://example.com/thumb.jpg',
      score: 0.9,
      matchedChunks: 1,
      bestChunk: {
        content: 'TypeScript is great',
        startTime: 0,
        similarity: 0.9,
      },
    });
  });

  it('aggregates multiple chunks from same video', () => {
    const chunks: SearchResult[] = [
      {
        chunkId: 1,
        content: 'TypeScript is great',
        startTime: 0,
        endTime: 10,
        similarity: 0.7,
        videoId: 1,
        videoTitle: 'TypeScript Basics',
        channel: 'Dev Channel',
        youtubeId: 'abc123',
        thumbnail: 'https://example.com/thumb.jpg',
      },
      {
        chunkId: 2,
        content: 'TypeScript has types',
        startTime: 10,
        endTime: 20,
        similarity: 0.9, // Higher score
        videoId: 1,
        videoTitle: 'TypeScript Basics',
        channel: 'Dev Channel',
        youtubeId: 'abc123',
        thumbnail: 'https://example.com/thumb.jpg',
      },
      {
        chunkId: 3,
        content: 'TypeScript compiles to JavaScript',
        startTime: 20,
        endTime: 30,
        similarity: 0.6,
        videoId: 1,
        videoTitle: 'TypeScript Basics',
        channel: 'Dev Channel',
        youtubeId: 'abc123',
        thumbnail: 'https://example.com/thumb.jpg',
      },
    ];

    const results = aggregateByVideo(chunks);

    expect(results).toHaveLength(1);
    expect(results[0]?.matchedChunks).toBe(3);
    expect(results[0]?.score).toBe(0.9); // Max score
    expect(results[0]?.bestChunk).toEqual({
      content: 'TypeScript has types',
      startTime: 10,
      similarity: 0.9,
    });
  });

  it('aggregates chunks from multiple videos', () => {
    const chunks: SearchResult[] = [
      {
        chunkId: 1,
        content: 'TypeScript basics',
        startTime: 0,
        endTime: 10,
        similarity: 0.8,
        videoId: 1,
        videoTitle: 'TypeScript Basics',
        channel: 'Dev Channel',
        youtubeId: 'abc123',
        thumbnail: 'https://example.com/thumb1.jpg',
      },
      {
        chunkId: 2,
        content: 'JavaScript intro',
        startTime: 0,
        endTime: 10,
        similarity: 0.9,
        videoId: 2,
        videoTitle: 'JavaScript 101',
        channel: 'JS Channel',
        youtubeId: 'def456',
        thumbnail: 'https://example.com/thumb2.jpg',
      },
      {
        chunkId: 3,
        content: 'TypeScript advanced',
        startTime: 10,
        endTime: 20,
        similarity: 0.7,
        videoId: 1,
        videoTitle: 'TypeScript Basics',
        channel: 'Dev Channel',
        youtubeId: 'abc123',
        thumbnail: 'https://example.com/thumb1.jpg',
      },
    ];

    const results = aggregateByVideo(chunks);

    expect(results).toHaveLength(2);

    // Results should be sorted by score (desc)
    expect(results[0]?.videoId).toBe(2); // Score 0.9
    expect(results[0]?.score).toBe(0.9);
    expect(results[0]?.matchedChunks).toBe(1);

    expect(results[1]?.videoId).toBe(1); // Score 0.8 (max of 0.8 and 0.7)
    expect(results[1]?.score).toBe(0.8);
    expect(results[1]?.matchedChunks).toBe(2);
  });

  it('handles empty array', () => {
    const results = aggregateByVideo([]);
    expect(results).toEqual([]);
  });

  it('handles null timestamps', () => {
    const chunks: SearchResult[] = [
      {
        chunkId: 1,
        content: 'Content without timestamps',
        startTime: null,
        endTime: null,
        similarity: 0.8,
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'abc123',
        thumbnail: null,
      },
    ];

    const results = aggregateByVideo(chunks);

    expect(results).toHaveLength(1);
    expect(results[0]?.bestChunk.startTime).toBeNull();
  });

  it('handles null thumbnail', () => {
    const chunks: SearchResult[] = [
      {
        chunkId: 1,
        content: 'Content',
        startTime: 0,
        endTime: 10,
        similarity: 0.8,
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'abc123',
        thumbnail: null,
      },
    ];

    const results = aggregateByVideo(chunks);

    expect(results).toHaveLength(1);
    expect(results[0]?.thumbnail).toBeNull();
  });

  it('keeps highest scoring chunk as bestChunk when multiple chunks exist', () => {
    const chunks: SearchResult[] = [
      {
        chunkId: 1,
        content: 'First chunk',
        startTime: 0,
        endTime: 10,
        similarity: 0.5,
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'abc123',
        thumbnail: null,
      },
      {
        chunkId: 2,
        content: 'Best chunk',
        startTime: 10,
        endTime: 20,
        similarity: 0.95, // Highest
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'abc123',
        thumbnail: null,
      },
      {
        chunkId: 3,
        content: 'Middle chunk',
        startTime: 20,
        endTime: 30,
        similarity: 0.7,
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'abc123',
        thumbnail: null,
      },
    ];

    const results = aggregateByVideo(chunks);

    expect(results).toHaveLength(1);
    expect(results[0]?.bestChunk.content).toBe('Best chunk');
    expect(results[0]?.bestChunk.similarity).toBe(0.95);
    expect(results[0]?.score).toBe(0.95);
  });

  it('sorts videos by score in descending order', () => {
    const chunks: SearchResult[] = [
      {
        chunkId: 1,
        content: 'Low score',
        startTime: 0,
        endTime: 10,
        similarity: 0.3,
        videoId: 1,
        videoTitle: 'Video 1',
        channel: 'Channel 1',
        youtubeId: 'vid1',
        thumbnail: null,
      },
      {
        chunkId: 2,
        content: 'High score',
        startTime: 0,
        endTime: 10,
        similarity: 0.95,
        videoId: 2,
        videoTitle: 'Video 2',
        channel: 'Channel 2',
        youtubeId: 'vid2',
        thumbnail: null,
      },
      {
        chunkId: 3,
        content: 'Medium score',
        startTime: 0,
        endTime: 10,
        similarity: 0.6,
        videoId: 3,
        videoTitle: 'Video 3',
        channel: 'Channel 3',
        youtubeId: 'vid3',
        thumbnail: null,
      },
    ];

    const results = aggregateByVideo(chunks);

    expect(results).toHaveLength(3);
    expect(results[0]?.score).toBe(0.95);
    expect(results[1]?.score).toBe(0.6);
    expect(results[2]?.score).toBe(0.3);
  });
});
