import { describe, it, expect, beforeEach, vi } from 'vitest'

// Track db operations
let selectCallIndex = 0
const mockSelectResults: Record<number, unknown[]> = {}
const mockInsertResult: unknown[] = []
let mockDeleteCalled = false

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return {
    ...actual,
    db: {
      select: vi.fn().mockImplementation(() => {
        const idx = selectCallIndex++
        const results = mockSelectResults[idx] ?? []
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(results),
            }),
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(results),
            }),
          }),
        }
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(mockInsertResult),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          mockDeleteCalled = true
          return Promise.resolve()
        }),
      }),
    },
  }
})

// Import after mocking
const { GET, POST, DELETE } = await import('../route')

describe('GET /api/videos/[id]/focus-areas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallIndex = 0
    Object.keys(mockSelectResults).forEach(k => delete mockSelectResults[Number(k)])
  })

  it('returns empty array when video has no focus areas', async () => {
    // First select: video exists
    mockSelectResults[0] = [{ id: 1, youtubeId: 'test-123', title: 'Test Video' }]
    // Second select: no focus areas
    mockSelectResults[1] = []

    const request = new Request('http://localhost:3000/api/videos/1/focus-areas')
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.focusAreas).toEqual([])
  })

  it('returns all focus areas for video', async () => {
    // First select: video exists
    mockSelectResults[0] = [{ id: 1, youtubeId: 'test-123', title: 'Test Video' }]
    // Second select: focus areas
    mockSelectResults[1] = [
      { id: 10, name: 'React', color: '#61dafb', createdAt: new Date() },
      { id: 11, name: 'TypeScript', color: '#3178c6', createdAt: new Date() },
    ]

    const request = new Request('http://localhost:3000/api/videos/1/focus-areas')
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.focusAreas).toHaveLength(2)
    expect(data.focusAreas.map((fa: { name: string }) => fa.name).sort()).toEqual(['React', 'TypeScript'])
  })

  it('returns 404 when video does not exist', async () => {
    mockSelectResults[0] = []

    const request = new Request('http://localhost:3000/api/videos/99999/focus-areas')
    const response = await GET(request, { params: Promise.resolve({ id: '99999' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })
})

describe('POST /api/videos/[id]/focus-areas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallIndex = 0
    Object.keys(mockSelectResults).forEach(k => delete mockSelectResults[Number(k)])
  })

  it('assigns focus area to video', async () => {
    // First select: video exists
    mockSelectResults[0] = [{ id: 1, youtubeId: 'test-123', title: 'Test Video' }]
    // Second select: focus area exists
    mockSelectResults[1] = [{ id: 10, name: 'React' }]
    // Third select: no existing assignment
    mockSelectResults[2] = []

    const request = new Request('http://localhost:3000/api/videos/1/focus-areas', {
      method: 'POST',
      body: JSON.stringify({ focusAreaId: 10 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(201)
  })

  it('returns 400 when focusAreaId is missing', async () => {
    const request = new Request('http://localhost:3000/api/videos/1/focus-areas', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 404 when video does not exist', async () => {
    mockSelectResults[0] = []

    const request = new Request('http://localhost:3000/api/videos/99999/focus-areas', {
      method: 'POST',
      body: JSON.stringify({ focusAreaId: 10 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: '99999' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Video not found')
  })

  it('returns 404 when focus area does not exist', async () => {
    // Video exists
    mockSelectResults[0] = [{ id: 1, youtubeId: 'test-123', title: 'Test Video' }]
    // Focus area does not exist
    mockSelectResults[1] = []

    const request = new Request('http://localhost:3000/api/videos/1/focus-areas', {
      method: 'POST',
      body: JSON.stringify({ focusAreaId: 99999 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Focus area not found')
  })

  it('returns 409 when assignment already exists', async () => {
    // Video exists
    mockSelectResults[0] = [{ id: 1, youtubeId: 'test-123', title: 'Test Video' }]
    // Focus area exists
    mockSelectResults[1] = [{ id: 10, name: 'React' }]
    // Assignment already exists
    mockSelectResults[2] = [{ videoId: 1, focusAreaId: 10 }]

    const request = new Request('http://localhost:3000/api/videos/1/focus-areas', {
      method: 'POST',
      body: JSON.stringify({ focusAreaId: 10 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('already assigned')
  })
})

describe('DELETE /api/videos/[id]/focus-areas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallIndex = 0
    mockDeleteCalled = false
    Object.keys(mockSelectResults).forEach(k => delete mockSelectResults[Number(k)])
  })

  it('removes focus area from video', async () => {
    // Video exists
    mockSelectResults[0] = [{ id: 1, youtubeId: 'test-123', title: 'Test Video' }]
    // Assignment exists
    mockSelectResults[1] = [{ videoId: 1, focusAreaId: 10 }]

    const request = new Request(
      'http://localhost:3000/api/videos/1/focus-areas?focusAreaId=10',
      { method: 'DELETE' },
    )

    const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(204)
  })

  it('returns 400 when focusAreaId is missing', async () => {
    const request = new Request('http://localhost:3000/api/videos/1/focus-areas', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('focusAreaId')
  })

  it('returns 404 when video does not exist', async () => {
    mockSelectResults[0] = []

    const request = new Request(
      'http://localhost:3000/api/videos/99999/focus-areas?focusAreaId=1',
      { method: 'DELETE' },
    )

    const response = await DELETE(request, { params: Promise.resolve({ id: '99999' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Video not found')
  })

  it('returns 404 when assignment does not exist', async () => {
    // Video exists
    mockSelectResults[0] = [{ id: 1, youtubeId: 'test-123', title: 'Test Video' }]
    // Assignment does not exist
    mockSelectResults[1] = []

    const request = new Request(
      'http://localhost:3000/api/videos/1/focus-areas?focusAreaId=10',
      { method: 'DELETE' },
    )

    const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not assigned')
  })
})
