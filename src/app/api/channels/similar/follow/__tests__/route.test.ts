import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { POST } from '../route'
import { db, channels, videos } from '@/lib/db'

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  channels: {
    name: 'name',
    channelId: 'channelId',
  },
  videos: {
    id: 'id',
    youtubeId: 'youtubeId',
    channel: 'channel',
  },
}))

describe('POST /api/channels/similar/follow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 when channelName is missing', async () => {
    const request = new Request('http://localhost/api/channels/similar/follow', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 400 when channelName is empty string', async () => {
    const request = new Request('http://localhost/api/channels/similar/follow', {
      method: 'POST',
      body: JSON.stringify({ channelName: '' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 404 when no videos found for channel name', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })
    ;(db.select as ReturnType<typeof vi.fn>) = mockSelect

    const request = new Request('http://localhost/api/channels/similar/follow', {
      method: 'POST',
      body: JSON.stringify({ channelName: 'Unknown Channel' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('No videos found')
  })

  it('creates channel entry when videos exist for channel name', async () => {
    const mockVideo = {
      id: 1,
      youtubeId: 'test123',
      channel: 'Test Channel',
    }

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockVideo]),
        }),
      }),
    })

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            channelId: 'channel-test-channel',
            name: 'Test Channel',
          },
        ]),
      }),
    })

    ;(db.select as ReturnType<typeof vi.fn>) = mockSelect
    ;(db.insert as ReturnType<typeof vi.fn>) = mockInsert

    const request = new Request('http://localhost/api/channels/similar/follow', {
      method: 'POST',
      body: JSON.stringify({ channelName: 'Test Channel' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.channel).toBeDefined()
    expect(data.channel.name).toBe('Test Channel')
  })

  it('generates channel ID from channel name', async () => {
    const mockVideo = {
      id: 1,
      youtubeId: 'test123',
      channel: 'Test Channel With Spaces',
    }

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockVideo]),
        }),
      }),
    })

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            channelId: 'channel-test-channel-with-spaces',
            name: 'Test Channel With Spaces',
          },
        ]),
      }),
    })

    ;(db.select as ReturnType<typeof vi.fn>) = mockSelect
    ;(db.insert as ReturnType<typeof vi.fn>) = mockInsert

    const request = new Request('http://localhost/api/channels/similar/follow', {
      method: 'POST',
      body: JSON.stringify({ channelName: 'Test Channel With Spaces' }),
    })

    await POST(request)

    // Verify insert was called with generated channelId
    expect(mockInsert).toHaveBeenCalledWith(channels)
    const insertCall = mockInsert.mock.results[0]!
    const valuesCall = insertCall.value.values
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: expect.stringContaining('channel-'),
        name: 'Test Channel With Spaces',
      })
    )
  })

  it('returns 409 when channel already followed', async () => {
    const mockVideo = {
      id: 1,
      youtubeId: 'test123',
      channel: 'Test Channel',
    }

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockVideo]),
        }),
      }),
    })

    const duplicateError = new Error('duplicate key value violates unique constraint')
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(duplicateError),
      }),
    })

    ;(db.select as ReturnType<typeof vi.fn>) = mockSelect
    ;(db.insert as ReturnType<typeof vi.fn>) = mockInsert

    const request = new Request('http://localhost/api/channels/similar/follow', {
      method: 'POST',
      body: JSON.stringify({ channelName: 'Test Channel' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('already followed')
  })

  it('returns 500 when database error occurs', async () => {
    const mockVideo = {
      id: 1,
      youtubeId: 'test123',
      channel: 'Test Channel',
    }

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockVideo]),
        }),
      }),
    })

    const dbError = new Error('Database connection failed')
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(dbError),
      }),
    })

    ;(db.select as ReturnType<typeof vi.fn>) = mockSelect
    ;(db.insert as ReturnType<typeof vi.fn>) = mockInsert

    const request = new Request('http://localhost/api/channels/similar/follow', {
      method: 'POST',
      body: JSON.stringify({ channelName: 'Test Channel' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('Failed to follow channel')
  })
})
