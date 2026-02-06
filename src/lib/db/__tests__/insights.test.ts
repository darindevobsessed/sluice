import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupTestDb, teardownTestDb, getTestDb, schema } from './setup';
import {
  getExtractionForVideo,
  upsertExtraction,
  deleteExtraction,
} from '../insights';
import type { ExtractionResult } from '@/lib/claude/prompts/types';

describe('getExtractionForVideo (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('returns null when no extraction exists', async () => {
    const db = getTestDb();

    // Create a video without extraction
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    const result = await getExtractionForVideo(video!.id, db);
    expect(result).toBeNull();
  });

  it('returns extraction with correct data', async () => {
    const db = getTestDb();

    // Create a video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    // Create extraction
    const extraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Test TLDR',
        overview: 'Test overview',
        keyPoints: ['Point 1', 'Point 2'],
      },
      insights: [
        {
          title: 'Test Insight',
          timestamp: '00:05:30',
          explanation: 'Test explanation',
          actionable: 'Test action',
        },
      ],
      actionItems: {
        immediate: ['Task 1'],
        shortTerm: ['Task 2'],
        longTerm: ['Task 3'],
        resources: [{ name: 'Resource 1', description: 'Description 1' }],
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

    await upsertExtraction(video!.id, extraction, db);

    const result = await getExtractionForVideo(video!.id, db);
    expect(result).not.toBeNull();
    expect(result?.videoId).toBe(video!.id);
    expect(result?.contentType).toBe('dev');
    expect(result?.extraction.summary.tldr).toBe('Test TLDR');
    expect(result?.extraction.insights).toHaveLength(1);
  });
});

describe('upsertExtraction (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('creates new extraction when none exists', async () => {
    const db = getTestDb();

    // Create a video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    const extraction: ExtractionResult = {
      contentType: 'educational',
      summary: {
        tldr: 'New TLDR',
        overview: 'New overview',
        keyPoints: ['Point 1'],
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

    const result = await upsertExtraction(video!.id, extraction, db);

    expect(result.videoId).toBe(video!.id);
    expect(result.contentType).toBe('educational');
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('updates existing extraction', async () => {
    const db = getTestDb();

    // Create a video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    // Create initial extraction
    const initialExtraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Initial TLDR',
        overview: 'Initial overview',
        keyPoints: ['Point 1'],
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

    const first = await upsertExtraction(video!.id, initialExtraction, db);

    // Wait a moment to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Update with new extraction
    const updatedExtraction: ExtractionResult = {
      contentType: 'meeting',
      summary: {
        tldr: 'Updated TLDR',
        overview: 'Updated overview',
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

    const second = await upsertExtraction(video!.id, updatedExtraction, db);

    expect(second.id).toBe(first.id); // Same ID
    expect(second.contentType).toBe('meeting');
    expect(second.extraction.summary.tldr).toBe('Updated TLDR');
    expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
  });

  it('enforces one extraction per video', async () => {
    const db = getTestDb();

    // Create a video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    const extraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Test TLDR',
        overview: 'Test overview',
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

    // Create extraction twice
    await upsertExtraction(video!.id, extraction, db);
    await upsertExtraction(video!.id, extraction, db);

    // Verify only one extraction exists
    const results = await db
      .select()
      .from(schema.insights)
      .where(eq(schema.insights.videoId, video!.id));

    expect(results).toHaveLength(1);
  });
});

describe('deleteExtraction (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('deletes extraction', async () => {
    const db = getTestDb();

    // Create a video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    // Create extraction
    const extraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Test TLDR',
        overview: 'Test overview',
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

    await upsertExtraction(video!.id, extraction, db);

    // Verify extraction exists
    const before = await getExtractionForVideo(video!.id, db);
    expect(before).not.toBeNull();

    // Delete extraction
    await deleteExtraction(video!.id, db);

    // Verify extraction deleted
    const after = await getExtractionForVideo(video!.id, db);
    expect(after).toBeNull();
  });

  it('does not throw when deleting non-existent extraction', async () => {
    const db = getTestDb();

    // Create a video without extraction
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    // Should not throw
    await expect(deleteExtraction(video!.id, db)).resolves.not.toThrow();
  });
});

describe('edge cases (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('handles empty arrays in extraction', async () => {
    const db = getTestDb();

    // Create a video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    const extraction: ExtractionResult = {
      contentType: 'general',
      summary: {
        tldr: 'Test TLDR',
        overview: 'Test overview',
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

    await upsertExtraction(video!.id, extraction, db);

    const result = await getExtractionForVideo(video!.id, db);
    expect(result?.extraction.insights).toEqual([]);
    expect(result?.extraction.summary.keyPoints).toEqual([]);
    expect(result?.extraction.actionItems.immediate).toEqual([]);
  });

  it('handles large extraction data', async () => {
    const db = getTestDb();

    // Create a video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    // Create large extraction with many insights
    const insights = Array.from({ length: 100 }, (_, i) => ({
      title: `Insight ${i}`,
      timestamp: '00:05:30',
      explanation: `Explanation ${i} `.repeat(50), // Large text
      actionable: `Action ${i}`,
    }));

    const extraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Test TLDR',
        overview: 'Test overview '.repeat(100), // Large text
        keyPoints: Array.from({ length: 50 }, (_, i) => `Key point ${i}`),
      },
      insights,
      actionItems: {
        immediate: Array.from({ length: 20 }, (_, i) => `Immediate ${i}`),
        shortTerm: Array.from({ length: 20 }, (_, i) => `Short term ${i}`),
        longTerm: Array.from({ length: 20 }, (_, i) => `Long term ${i}`),
        resources: Array.from({ length: 20 }, (_, i) => ({
          name: `Resource ${i}`,
          description: `Description ${i}`,
        })),
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

    await upsertExtraction(video!.id, extraction, db);

    const result = await getExtractionForVideo(video!.id, db);
    expect(result?.extraction.insights).toHaveLength(100);
    expect(result?.extraction.summary.keyPoints).toHaveLength(50);
    expect(result?.extraction.actionItems.immediate).toHaveLength(20);
  });
});
