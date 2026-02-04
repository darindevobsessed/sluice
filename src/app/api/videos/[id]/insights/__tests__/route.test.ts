import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '../route';
import { db, sqlite } from '@/lib/db';
import { upsertExtraction, deleteExtraction } from '@/lib/db/insights';
import type { ExtractionResult } from '@/lib/claude/prompts/types';

describe('GET /api/videos/[id]/insights', () => {
  let testVideoId: number;

  beforeEach(() => {
    // Create a test video in the default database
    const video = sqlite
      .prepare(
        'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
      )
      .get('test123', 'Test Video', 'Test Channel') as { id: number };
    testVideoId = video.id;
  });

  afterEach(async () => {
    // Clean up test data
    await deleteExtraction(testVideoId);
    sqlite.prepare('DELETE FROM videos WHERE id = ?').run(testVideoId);
  });

  it('should return null for video without extraction', async () => {
    const request = new Request('http://localhost:3000/api/videos/1/insights');
    const params = Promise.resolve({ id: String(testVideoId) });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.extraction).toBeNull();
    expect(data.generatedAt).toBeNull();
  });

  it('should return extraction when it exists', async () => {
    // Create extraction
    const mockExtraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Test summary',
        overview: 'Test overview',
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
        applicable: true,
        skills: [],
        commands: [],
        agents: [],
        hooks: [],
        rules: [],
      },
    };

    await upsertExtraction(testVideoId, mockExtraction);

    const request = new Request('http://localhost:3000/api/videos/1/insights');
    const params = Promise.resolve({ id: String(testVideoId) });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.extraction).toEqual(mockExtraction);
    expect(data.generatedAt).toBeDefined();
    expect(typeof data.generatedAt).toBe('string');
  });

  it('should return null for non-existent video ID', async () => {
    const request = new Request('http://localhost:3000/api/videos/99999/insights');
    const params = Promise.resolve({ id: '99999' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.extraction).toBeNull();
    expect(data.generatedAt).toBeNull();
  });
});

describe('POST /api/videos/[id]/insights', () => {
  let testVideoId: number;

  beforeEach(() => {
    // Create a test video in the default database
    const video = sqlite
      .prepare(
        'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
      )
      .get('test456', 'Test Video 2', 'Test Channel') as { id: number };
    testVideoId = video.id;
  });

  afterEach(async () => {
    // Clean up test data
    await deleteExtraction(testVideoId);
    sqlite.prepare('DELETE FROM videos WHERE id = ?').run(testVideoId);
  });

  it('should create new extraction', async () => {
    const mockExtraction: ExtractionResult = {
      contentType: 'educational',
      summary: {
        tldr: 'Educational content',
        overview: 'Learning material',
        keyPoints: ['Learn this'],
      },
      insights: [
        {
          title: 'Key insight',
          timestamp: '00:05:00',
          explanation: 'Important info',
          actionable: 'Apply this',
        },
      ],
      actionItems: {
        immediate: ['Do now'],
        shortTerm: ['Do soon'],
        longTerm: ['Do later'],
        resources: [{ name: 'Resource 1', description: 'Helpful' }],
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

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extraction: mockExtraction }),
    });
    const params = Promise.resolve({ id: String(testVideoId) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.extraction).toEqual(mockExtraction);
    expect(data.generatedAt).toBeDefined();
    expect(typeof data.generatedAt).toBe('string');
  });

  it('should update existing extraction', async () => {
    const firstExtraction: ExtractionResult = {
      contentType: 'general',
      summary: {
        tldr: 'First version',
        overview: 'First',
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

    await upsertExtraction(testVideoId, firstExtraction);

    const updatedExtraction: ExtractionResult = {
      ...firstExtraction,
      contentType: 'dev',
      summary: {
        tldr: 'Updated version',
        overview: 'Updated',
        keyPoints: ['New point'],
      },
    };

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extraction: updatedExtraction }),
    });
    const params = Promise.resolve({ id: String(testVideoId) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.extraction.contentType).toBe('dev');
    expect(data.extraction.summary.tldr).toBe('Updated version');
  });

  it('should return 400 for invalid extraction format', async () => {
    const invalidExtraction = {
      // Missing required fields
      summary: { tldr: 'Test' },
    };

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extraction: invalidExtraction }),
    });
    const params = Promise.resolve({ id: String(testVideoId) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error).toContain('Invalid extraction format');
  });

  it('should return 400 for missing extraction in body', async () => {
    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const params = Promise.resolve({ id: String(testVideoId) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('should handle malformed JSON', async () => {
    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json',
    });
    const params = Promise.resolve({ id: String(testVideoId) });

    await expect(POST(request, { params })).rejects.toThrow();
  });
});

describe('edge cases', () => {
  let testVideoId: number;

  beforeEach(() => {
    const video = sqlite
      .prepare(
        'INSERT INTO videos (youtube_id, title, channel) VALUES (?, ?, ?) RETURNING id'
      )
      .get('test789', 'Test Video 3', 'Test Channel') as { id: number };
    testVideoId = video.id;
  });

  afterEach(async () => {
    await deleteExtraction(testVideoId);
    sqlite.prepare('DELETE FROM videos WHERE id = ?').run(testVideoId);
  });

  it('should handle large extraction data', async () => {
    const largeExtraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Large test',
        overview: 'A'.repeat(10000),
        keyPoints: Array(100)
          .fill(0)
          .map((_, i) => `Point ${i}`),
      },
      insights: Array(50)
        .fill(0)
        .map((_, i) => ({
          title: `Insight ${i}`,
          timestamp: '00:00:00',
          explanation: 'Explanation',
          actionable: 'Action',
        })),
      actionItems: {
        immediate: Array(20)
          .fill(0)
          .map((_, i) => `Immediate ${i}`),
        shortTerm: Array(20)
          .fill(0)
          .map((_, i) => `Short ${i}`),
        longTerm: Array(20)
          .fill(0)
          .map((_, i) => `Long ${i}`),
        resources: [],
      },
      claudeCode: {
        applicable: true,
        skills: Array(10)
          .fill(0)
          .map((_, i) => ({
            name: `skill-${i}`,
            description: 'Desc',
            allowedTools: ['Read'],
            instructions: 'Instructions',
          })),
        commands: [],
        agents: [],
        hooks: [],
        rules: [],
      },
    };

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extraction: largeExtraction }),
    });
    const params = Promise.resolve({ id: String(testVideoId) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.extraction.summary.overview.length).toBe(10000);
    expect(data.extraction.insights.length).toBe(50);
  });

  it('should handle empty arrays in extraction', async () => {
    const emptyExtraction: ExtractionResult = {
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

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extraction: emptyExtraction }),
    });
    const params = Promise.resolve({ id: String(testVideoId) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.extraction).toEqual(emptyExtraction);
  });
});
