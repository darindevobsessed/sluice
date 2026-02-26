import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/auth-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-guards')>()
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(null),
  }
})

// Mock channel and focus area query results
let mockChannelResults: { channel: string | null; videoCount: number }[] = []
let mockFocusAreaResults: { id: number; name: string; color: string | null; createdAt: Date }[] = []
let selectCallIndex = 0

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return {
    ...actual,
    db: {
      select: vi.fn().mockImplementation(() => {
        const idx = selectCallIndex++
        if (idx === 0) {
          // First call: channels query (with groupBy and orderBy)
          return {
            from: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockChannelResults),
              }),
            }),
          }
        } else {
          // Second call: focusAreas query
          return {
            from: vi.fn().mockResolvedValue(mockFocusAreaResults),
          }
        }
      }),
    },
  }
})

// Import after mocking
const { GET } = await import('../route')

describe('GET /api/sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallIndex = 0
    mockChannelResults = []
    mockFocusAreaResults = []
  })

  it('returns empty channels and focus areas when nothing exists', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toEqual([])
    expect(data.focusAreas).toEqual([])
  })

  it('returns channels with video counts sorted by count descending', async () => {
    mockChannelResults = [
      { channel: 'Fireship', videoCount: 3 },
      { channel: 'Theo', videoCount: 2 },
      { channel: 'ThePrimeagen', videoCount: 1 },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(3)

    expect(data.channels[0]).toEqual({ name: 'Fireship', videoCount: 3 })
    expect(data.channels[1]).toEqual({ name: 'Theo', videoCount: 2 })
    expect(data.channels[2]).toEqual({ name: 'ThePrimeagen', videoCount: 1 })
  })

  it('excludes videos with null channel from channel list', async () => {
    mockChannelResults = [
      { channel: 'Known Channel', videoCount: 1 },
      { channel: null, videoCount: 1 },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(1)
    expect(data.channels[0].name).toBe('Known Channel')
  })

  it('returns channel with correct name shape', async () => {
    mockChannelResults = [
      { channel: 'My Channel', videoCount: 1 },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels[0]).toHaveProperty('name')
    expect(data.channels[0]).toHaveProperty('videoCount')
    expect(data.channels[0]).not.toHaveProperty('channel')
    expect(data.channels[0].name).toBe('My Channel')
    expect(data.channels[0].videoCount).toBe(1)
  })

  it('returns all focus areas with id, name, color, and createdAt', async () => {
    const now = new Date()
    mockFocusAreaResults = [
      { id: 1, name: 'React', color: '#61dafb', createdAt: now },
      { id: 2, name: 'TypeScript', color: '#3178c6', createdAt: now },
      { id: 3, name: 'Testing', color: null, createdAt: now },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.focusAreas).toHaveLength(3)
    expect(data.focusAreas[0]).toHaveProperty('id')
    expect(data.focusAreas[0]).toHaveProperty('name')
    expect(data.focusAreas[0]).toHaveProperty('color')
    expect(data.focusAreas[0]).toHaveProperty('createdAt')

    const reactArea = data.focusAreas.find((f: { name: string }) => f.name === 'React')
    expect(reactArea).toBeDefined()
    expect(reactArea.color).toBe('#61dafb')

    const testingArea = data.focusAreas.find((f: { name: string }) => f.name === 'Testing')
    expect(testingArea).toBeDefined()
    expect(testingArea.color).toBeNull()
  })

  it('returns both channels and focus areas together in one response', async () => {
    mockChannelResults = [
      { channel: 'My Creator', videoCount: 1 },
    ]
    mockFocusAreaResults = [
      { id: 1, name: 'Frontend', color: '#f7df1e', createdAt: new Date() },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(1)
    expect(data.channels[0].name).toBe('My Creator')
    expect(data.focusAreas).toHaveLength(1)
    expect(data.focusAreas[0].name).toBe('Frontend')
  })

  it('videoCount is a number (not a string from SQL count)', async () => {
    mockChannelResults = [
      { channel: 'Type Check Channel', videoCount: 1 },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(typeof data.channels[0].videoCount).toBe('number')
    expect(data.channels[0].videoCount).toBe(1)
  })
})
