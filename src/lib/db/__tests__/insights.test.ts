import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase } from '../index';
import type { DatabaseInstance } from '../index';
import { getExtractionForVideo, upsertExtraction, deleteExtraction } from '../insights';
import type { ExtractionResult } from '@/lib/claude/prompts/types';

describe('insights database functions', () => {
  let testDb: DatabaseInstance;

  beforeEach(() => {
    // Create a fresh in-memory database for each test
    testDb = createDatabase(':memory:');
  });

  afterEach(() => {
    testDb.close();
  });

  describe('getExtractionForVideo', () => {
    it('should return null for video without extraction', async () => {
      // Insert a test video
      const video = testDb.sqlite
        .prepare(
          'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
        )
        .get('test123', 'Test Video', 'Test Channel') as { id: number };

      const result = await getExtractionForVideo(video.id, testDb.db);
      expect(result).toBeNull();
    });

    it('should return extraction when it exists', async () => {
      // Insert test video
      const video = testDb.sqlite
        .prepare(
          'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
        )
        .get('test123', 'Test Video', 'Test Channel') as { id: number };

      // Insert extraction
      const mockExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: {
          tldr: 'Test summary',
          overview: 'Test overview',
          keyPoints: ['Point 1', 'Point 2'],
        },
        insights: [],
        actionItems: {
          immediate: [],
          shortTerm: [],
          longTerm: [],
          resources: [],
        },
        claudeCode: {
          applicable: true,
          skills: [],
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      };

      await upsertExtraction(video.id, mockExtraction, testDb.db);

      const result = await getExtractionForVideo(video.id, testDb.db);
      expect(result).not.toBeNull();
      expect(result?.contentType).toBe('dev');
      expect(result?.extraction).toEqual(mockExtraction);
    });

    it('should return null for non-existent video', async () => {
      const result = await getExtractionForVideo(99999, testDb.db);
      expect(result).toBeNull();
    });
  });

  describe('upsertExtraction', () => {
    it('should create new extraction for video', async () => {
      // Insert test video
      const video = testDb.sqlite
        .prepare(
          'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
        )
        .get('test123', 'Test Video', 'Test Channel') as { id: number };

      const mockExtraction: ExtractionResult = {
        contentType: 'educational',
        summary: {
          tldr: 'Educational content',
          overview: 'Learning material',
          keyPoints: ['Learn this', 'Learn that'],
        },
        insights: [
          {
            title: 'Key insight',
            timestamp: '00:05:00',
            explanation: 'This is important',
            actionable: 'Apply this technique',
          },
        ],
        actionItems: {
          immediate: ['Do this now'],
          shortTerm: ['Do this soon'],
          longTerm: ['Do this later'],
          resources: [{ name: 'Resource 1', description: 'Helpful resource' }],
        },
        claudeCode: {
          applicable: false,
          skills: [],
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      };

      const result = await upsertExtraction(video.id, mockExtraction, testDb.db);

      expect(result.id).toBeDefined();
      expect(result.videoId).toBe(video.id);
      expect(result.contentType).toBe('educational');
      expect(result.extraction).toEqual(mockExtraction);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should update existing extraction for video', async () => {
      // Insert test video
      const video = testDb.sqlite
        .prepare(
          'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
        )
        .get('test123', 'Test Video', 'Test Channel') as { id: number };

      const firstExtraction: ExtractionResult = {
        contentType: 'general',
        summary: {
          tldr: 'First version',
          overview: 'First overview',
          keyPoints: ['First point'],
        },
        insights: [],
        actionItems: {
          immediate: [],
          shortTerm: [],
          longTerm: [],
          resources: [],
        },
        claudeCode: {
          applicable: false,
          skills: [],
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      };

      const firstResult = await upsertExtraction(video.id, firstExtraction, testDb.db);
      const firstUpdatedAt = firstResult.updatedAt;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const secondExtraction: ExtractionResult = {
        ...firstExtraction,
        contentType: 'dev',
        summary: {
          tldr: 'Updated version',
          overview: 'Updated overview',
          keyPoints: ['Updated point'],
        },
      };

      const secondResult = await upsertExtraction(video.id, secondExtraction, testDb.db);

      expect(secondResult.id).toBe(firstResult.id); // Same ID
      expect(secondResult.contentType).toBe('dev');
      expect(secondResult.extraction.summary.tldr).toBe('Updated version');
      expect(secondResult.updatedAt.getTime()).toBeGreaterThan(
        firstUpdatedAt.getTime()
      );
    });

    it('should enforce one extraction per video', async () => {
      // Insert test video
      const video = testDb.sqlite
        .prepare(
          'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
        )
        .get('test123', 'Test Video', 'Test Channel') as { id: number };

      const mockExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: {
          tldr: 'Test',
          overview: 'Test',
          keyPoints: [],
        },
        insights: [],
        actionItems: {
          immediate: [],
          shortTerm: [],
          longTerm: [],
          resources: [],
        },
        claudeCode: {
          applicable: false,
          skills: [],
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      };

      await upsertExtraction(video.id, mockExtraction, testDb.db);
      await upsertExtraction(video.id, mockExtraction, testDb.db);

      // Check only one extraction exists
      const count = testDb.sqlite
        .prepare('SELECT COUNT(*) as count FROM insights WHERE video_id = ?')
        .get(video.id) as { count: number };

      expect(count.count).toBe(1);
    });
  });

  describe('deleteExtraction', () => {
    it('should delete extraction for video', async () => {
      // Insert test video
      const video = testDb.sqlite
        .prepare(
          'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
        )
        .get('test123', 'Test Video', 'Test Channel') as { id: number };

      const mockExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: {
          tldr: 'Test',
          overview: 'Test',
          keyPoints: [],
        },
        insights: [],
        actionItems: {
          immediate: [],
          shortTerm: [],
          longTerm: [],
          resources: [],
        },
        claudeCode: {
          applicable: false,
          skills: [],
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      };

      await upsertExtraction(video.id, mockExtraction, testDb.db);

      // Verify it exists
      let result = await getExtractionForVideo(video.id, testDb.db);
      expect(result).not.toBeNull();

      // Delete it
      await deleteExtraction(video.id, testDb.db);

      // Verify it's gone
      result = await getExtractionForVideo(video.id, testDb.db);
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent extraction', async () => {
      await expect(deleteExtraction(99999, testDb.db)).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays in extraction', async () => {
      const video = testDb.sqlite
        .prepare(
          'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
        )
        .get('test123', 'Test Video', 'Test Channel') as { id: number };

      const mockExtraction: ExtractionResult = {
        contentType: 'general',
        summary: {
          tldr: '',
          overview: '',
          keyPoints: [],
        },
        insights: [],
        actionItems: {
          immediate: [],
          shortTerm: [],
          longTerm: [],
          resources: [],
        },
        claudeCode: {
          applicable: false,
          skills: [],
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      };

      const result = await upsertExtraction(video.id, mockExtraction, testDb.db);
      expect(result.extraction).toEqual(mockExtraction);

      const retrieved = await getExtractionForVideo(video.id, testDb.db);
      expect(retrieved?.extraction).toEqual(mockExtraction);
    });

    it('should handle large extraction data', async () => {
      const video = testDb.sqlite
        .prepare(
          'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
        )
        .get('test123', 'Test Video', 'Test Channel') as { id: number };

      const mockExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: {
          tldr: 'Large data test',
          overview: 'A'.repeat(10000), // Large overview
          keyPoints: Array(100)
            .fill(0)
            .map((_, i) => `Point ${i}`),
        },
        insights: Array(50)
          .fill(0)
          .map((_, i) => ({
            title: `Insight ${i}`,
            timestamp: '00:00:00',
            explanation: 'Explanation'.repeat(100),
            actionable: 'Action'.repeat(100),
          })),
        actionItems: {
          immediate: Array(20)
            .fill(0)
            .map((_, i) => `Immediate ${i}`),
          shortTerm: Array(20)
            .fill(0)
            .map((_, i) => `Short term ${i}`),
          longTerm: Array(20)
            .fill(0)
            .map((_, i) => `Long term ${i}`),
          resources: Array(10)
            .fill(0)
            .map((_, i) => ({ name: `Resource ${i}`, description: `Desc ${i}` })),
        },
        claudeCode: {
          applicable: true,
          skills: Array(10)
            .fill(0)
            .map((_, i) => ({
              name: `skill-${i}`,
              description: 'Description',
              allowedTools: ['Read', 'Write'],
              instructions: 'Instructions'.repeat(100),
            })),
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      };

      const result = await upsertExtraction(video.id, mockExtraction, testDb.db);
      expect(result.extraction.summary.overview).toBe(mockExtraction.summary.overview);
      expect(result.extraction.insights.length).toBe(50);
      expect(result.extraction.claudeCode.skills.length).toBe(10);
    });
  });
});
