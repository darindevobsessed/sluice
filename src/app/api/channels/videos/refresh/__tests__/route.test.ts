import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRefreshDiscoveryVideos = vi.fn()

vi.mock('@/lib/automation/rss', () => ({
  refreshDiscoveryVideos: mockRefreshDiscoveryVideos,
}))

// Import after mocking
const { POST } = await import('../route')

describe('POST /api/channels/videos/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls refreshDiscoveryVideos and returns result', async () => {
    mockRefreshDiscoveryVideos.mockResolvedValue({
      videoCount: 15,
      channelCount: 3,
      errors: [],
    })

    const request = new Request('http://localhost/api/channels/videos/refresh', {
      method: 'POST',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      videoCount: 15,
      channelCount: 3,
      errors: [],
    })
    expect(mockRefreshDiscoveryVideos).toHaveBeenCalledTimes(1)
  })

  it('returns result including errors when some feeds fail', async () => {
    mockRefreshDiscoveryVideos.mockResolvedValue({
      videoCount: 5,
      channelCount: 2,
      errors: ['UCbad: RSS fetch failed'],
    })

    const request = new Request('http://localhost/api/channels/videos/refresh', {
      method: 'POST',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videoCount).toBe(5)
    expect(data.errors).toHaveLength(1)
  })

  it('returns 500 when refreshDiscoveryVideos throws', async () => {
    mockRefreshDiscoveryVideos.mockRejectedValue(new Error('Database connection failed'))

    const request = new Request('http://localhost/api/channels/videos/refresh', {
      method: 'POST',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
  })
})
