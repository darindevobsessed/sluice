import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { setupTestDb, teardownTestDb, getTestDb, schema } from '@/lib/db/__tests__/setup'
import type { ExtractionResult } from '@/lib/claude/prompts/types'

// Mock auth module
const mockGetSession = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}))

// Mock next/headers
const mockHeaders = vi.fn()
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

// Mock the insights module to use test database
vi.mock('@/lib/db/insights', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/insights')>('@/lib/db/insights')
  const setup = await import('@/lib/db/__tests__/setup')
  return {
    ...actual,
    getExtractionForVideo: (videoId: number) => actual.getExtractionForVideo(videoId, setup.getTestDb()),
    upsertExtraction: (videoId: number, extraction: ExtractionResult) =>
      actual.upsertExtraction(videoId, extraction, setup.getTestDb()),
    deleteExtraction: (videoId: number) => actual.deleteExtraction(videoId, setup.getTestDb()),
  }
})

// Import after mocking
const { GET, POST } = await import('../route')

describe('GET /api/videos/[id]/insights (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb()
    mockGetSession.mockResolvedValue({ user: { id: '1', email: 'test@devobsessed.com' } })
    mockHeaders.mockResolvedValue(new Headers())
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('returns null for video without extraction', async () => {
    const db = getTestDb()

    // Create video without extraction
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid-get-no-extraction',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const request = new Request('http://localhost:3000/api/videos/1/insights')
    const params = Promise.resolve({ id: String(video!.id) })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      extraction: null,
      generatedAt: null,
    })
  })

  it('returns extraction when it exists', async () => {
    const db = getTestDb()

    // Create video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid-get-with-extraction',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    // Create extraction
    const extraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Test TLDR',
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
        applicable: false,
        skills: [],
        commands: [],
        agents: [],
        hooks: [],
        rules: [],
      },
    }

    await db.insert(schema.insights).values({
      id: 'test-id',
      videoId: video!.id,
      contentType: 'dev',
      extraction: extraction as unknown as typeof schema.insights.$inferInsert.extraction,
    })

    const request = new Request('http://localhost:3000/api/videos/1/insights')
    const params = Promise.resolve({ id: String(video!.id) })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.extraction).toBeDefined()
    expect(data.extraction.contentType).toBe('dev')
    expect(data.extraction.summary.tldr).toBe('Test TLDR')
    expect(data.generatedAt).toBeDefined()
  })

  it('returns null for non-existent video ID', async () => {
    const request = new Request('http://localhost:3000/api/videos/999/insights')
    const params = Promise.resolve({ id: '999' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      extraction: null,
      generatedAt: null,
    })
  })
})

describe('POST /api/videos/[id]/insights (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb()
    mockGetSession.mockResolvedValue({ user: { id: '1', email: 'test@devobsessed.com' } })
    mockHeaders.mockResolvedValue(new Headers())
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('returns 401 when no session exists', async () => {
    mockGetSession.mockResolvedValue(null)

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction: {} }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('creates new extraction', async () => {
    const db = getTestDb()

    // Create video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid-post-create',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

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
    }

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: String(video!.id) })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.extraction.contentType).toBe('educational')
    expect(data.extraction.summary.tldr).toBe('New TLDR')
    expect(data.generatedAt).toBeDefined()
  })

  it('updates existing extraction', async () => {
    const db = getTestDb()

    // Create video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid-post-update',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    // Create initial extraction
    const initialExtraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Initial TLDR',
        overview: 'Initial overview',
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
    }

    await db.insert(schema.insights).values({
      id: 'test-id',
      videoId: video!.id,
      contentType: 'dev',
      extraction: initialExtraction as unknown as typeof schema.insights.$inferInsert.extraction,
    })

    // Update with new extraction
    const updatedExtraction: ExtractionResult = {
      contentType: 'meeting',
      summary: {
        tldr: 'Updated TLDR',
        overview: 'Updated overview',
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
    }

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction: updatedExtraction }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: String(video!.id) })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.extraction.contentType).toBe('meeting')
    expect(data.extraction.summary.tldr).toBe('Updated TLDR')
  })

  it('returns 400 for invalid extraction format (Zod validation)', async () => {
    const db = getTestDb()

    // Create video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid-post-invalid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    // Missing required fields (summary missing)
    const invalidExtraction = {
      contentType: 'dev',
      // Missing summary, insights, actionItems, claudeCode
    }

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction: invalidExtraction }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: String(video!.id) })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    // Zod provides specific field-level error messages, not the old generic message
    expect(data.error).toBeTruthy()
    expect(typeof data.error).toBe('string')
  })

  it('returns 400 for missing extraction in body (Zod validation)', async () => {
    const db = getTestDb()

    // Create video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid-post-missing',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({}), // No extraction field
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: String(video!.id) })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    // Zod provides specific field-level error messages
    expect(data.error).toBeTruthy()
    expect(typeof data.error).toBe('string')
  })

  it('handles malformed JSON with 400 (not 500)', async () => {
    const db = getTestDb()

    // Create video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid-post-malformed',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: 'not valid json{',
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: String(video!.id) })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid JSON in request body')
  })
})

describe('edge cases (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb()
    mockGetSession.mockResolvedValue({ user: { id: '1', email: 'test@devobsessed.com' } })
    mockHeaders.mockResolvedValue(new Headers())
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('handles large extraction data', async () => {
    const db = getTestDb()

    // Create video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid-edge-large',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    // Create large extraction
    const insights = Array.from({ length: 100 }, (_, i) => ({
      title: `Insight ${i}`,
      timestamp: '00:05:30',
      explanation: `Explanation ${i} `.repeat(50),
      actionable: `Action ${i}`,
    }))

    const extraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Test TLDR',
        overview: 'Test overview '.repeat(100),
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
    }

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: String(video!.id) })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.extraction.insights).toHaveLength(100)
  })

  it('handles empty arrays in extraction', async () => {
    const db = getTestDb()

    // Create video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid-edge-empty',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

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
    }

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: String(video!.id) })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.extraction.insights).toEqual([])
    expect(data.extraction.summary.keyPoints).toEqual([])
  })
})
