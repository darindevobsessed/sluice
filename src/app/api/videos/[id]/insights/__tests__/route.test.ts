import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ExtractionResult } from '@/lib/claude/prompts/types'
import type { NextResponse } from 'next/server'

// Mock auth module (kept for test infrastructure compatibility)
const mockGetSession = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}))

// Mock next/headers (kept for test infrastructure compatibility)
const mockHeaders = vi.fn()
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

vi.mock('@/lib/auth-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-guards')>()
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(null),
  }
})

// Mock the insights module
const mockGetExtractionForVideo = vi.fn()
const mockUpsertExtraction = vi.fn()
vi.mock('@/lib/db/insights', () => ({
  getExtractionForVideo: (...args: unknown[]) => mockGetExtractionForVideo(...args),
  upsertExtraction: (...args: unknown[]) => mockUpsertExtraction(...args),
  deleteExtraction: vi.fn(),
}))

// Import after mocking
const { GET, POST } = await import('../route')

const validExtraction: ExtractionResult = {
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

describe('GET /api/videos/[id]/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: { id: '1', email: 'test@devobsessed.com' } })
    mockHeaders.mockResolvedValue(new Headers())
  })

  it('returns null for video without extraction', async () => {
    mockGetExtractionForVideo.mockResolvedValue(null)

    const request = new Request('http://localhost:3000/api/videos/1/insights')
    const params = Promise.resolve({ id: '1' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      extraction: null,
      generatedAt: null,
    })
  })

  it('returns extraction when it exists', async () => {
    const updatedAt = new Date('2024-01-15T10:00:00Z')
    mockGetExtractionForVideo.mockResolvedValue({
      id: 'test-id',
      videoId: 1,
      contentType: 'dev',
      extraction: validExtraction,
      createdAt: updatedAt,
      updatedAt,
    })

    const request = new Request('http://localhost:3000/api/videos/1/insights')
    const params = Promise.resolve({ id: '1' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.extraction).toBeDefined()
    expect(data.extraction.contentType).toBe('dev')
    expect(data.extraction.summary.tldr).toBe('Test TLDR')
    expect(data.generatedAt).toBeDefined()
  })

  it('returns null for non-existent video ID', async () => {
    mockGetExtractionForVideo.mockResolvedValue(null)

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

describe('POST /api/videos/[id]/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: { id: '1', email: 'test@devobsessed.com' } })
    mockHeaders.mockResolvedValue(new Headers())
  })

  it('returns 401 when no session exists', async () => {
    const { requireSession } = await import('@/lib/auth-guards')
    vi.mocked(requireSession).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) as unknown as NextResponse
    )

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
    const updatedAt = new Date('2024-01-15T10:00:00Z')
    const extraction: ExtractionResult = {
      ...validExtraction,
      contentType: 'educational',
      summary: { tldr: 'New TLDR', overview: 'New overview', keyPoints: ['Point 1'] },
    }

    mockUpsertExtraction.mockResolvedValue({
      id: 'new-id',
      videoId: 1,
      contentType: 'educational',
      extraction,
      createdAt: updatedAt,
      updatedAt,
    })

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.extraction.contentType).toBe('educational')
    expect(data.extraction.summary.tldr).toBe('New TLDR')
    expect(data.generatedAt).toBeDefined()
  })

  it('updates existing extraction', async () => {
    const updatedAt = new Date('2024-01-15T10:00:00Z')
    const updatedExtraction: ExtractionResult = {
      ...validExtraction,
      contentType: 'meeting',
      summary: { tldr: 'Updated TLDR', overview: 'Updated overview', keyPoints: ['Point 1'] },
      claudeCode: { ...validExtraction.claudeCode, applicable: true },
    }

    mockUpsertExtraction.mockResolvedValue({
      id: 'updated-id',
      videoId: 1,
      contentType: 'meeting',
      extraction: updatedExtraction,
      createdAt: updatedAt,
      updatedAt,
    })

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction: updatedExtraction }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.extraction.contentType).toBe('meeting')
    expect(data.extraction.summary.tldr).toBe('Updated TLDR')
  })

  it('returns 400 for invalid extraction format (Zod validation)', async () => {
    const invalidExtraction = {
      contentType: 'dev',
      // Missing summary, insights, actionItems, claudeCode
    }

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction: invalidExtraction }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeTruthy()
    expect(typeof data.error).toBe('string')
  })

  it('returns 400 for missing extraction in body (Zod validation)', async () => {
    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeTruthy()
    expect(typeof data.error).toBe('string')
  })

  it('handles malformed JSON with 400 (not 500)', async () => {
    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: 'not valid json{',
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid JSON in request body')
  })
})

describe('edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: { id: '1', email: 'test@devobsessed.com' } })
    mockHeaders.mockResolvedValue(new Headers())
  })

  it('handles large extraction data', async () => {
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

    const updatedAt = new Date()
    mockUpsertExtraction.mockResolvedValue({
      id: 'large-id',
      videoId: 1,
      contentType: 'dev',
      extraction,
      createdAt: updatedAt,
      updatedAt,
    })

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.extraction.insights).toHaveLength(100)
  })

  it('handles empty arrays in extraction', async () => {
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

    const updatedAt = new Date()
    mockUpsertExtraction.mockResolvedValue({
      id: 'empty-id',
      videoId: 1,
      contentType: 'general',
      extraction,
      createdAt: updatedAt,
      updatedAt,
    })

    const request = new Request('http://localhost:3000/api/videos/1/insights', {
      method: 'POST',
      body: JSON.stringify({ extraction }),
      headers: { 'Content-Type': 'application/json' },
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.extraction.insights).toEqual([])
    expect(data.extraction.summary.keyPoints).toEqual([])
  })
})
