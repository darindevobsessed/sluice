import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logApiTiming, startApiTimer } from '../api-timing'
import type { ApiTimingResult } from '../api-timing'

describe('logApiTiming', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs successful request with console.info', () => {
    const result: ApiTimingResult = {
      route: '/api/search',
      method: 'GET',
      status: 200,
      durationMs: 45,
    }

    logApiTiming(result)

    expect(infoSpy).toHaveBeenCalledWith('[api] GET /api/search 200 in 45ms')
  })

  it('logs 4xx request with console.warn', () => {
    const result: ApiTimingResult = {
      route: '/api/videos',
      method: 'POST',
      status: 400,
      durationMs: 12,
    }

    logApiTiming(result)

    expect(warnSpy).toHaveBeenCalledWith('[api] POST /api/videos 400 in 12ms')
  })

  it('logs 5xx request with console.error', () => {
    const result: ApiTimingResult = {
      route: '/api/videos/1/embed',
      method: 'POST',
      status: 500,
      durationMs: 1500,
    }

    logApiTiming(result)

    expect(errorSpy).toHaveBeenCalledWith('[api] POST /api/videos/1/embed 500 in 1500ms')
  })

  it('includes metadata in log output', () => {
    const result: ApiTimingResult = {
      route: '/api/search',
      method: 'GET',
      status: 200,
      durationMs: 45,
      metadata: { resultCount: 5, mode: 'hybrid' },
    }

    logApiTiming(result)

    expect(infoSpy).toHaveBeenCalledWith(
      '[api] GET /api/search 200 in 45ms {"resultCount":5,"mode":"hybrid"}'
    )
  })

  it('omits metadata string when metadata is undefined', () => {
    logApiTiming({
      route: '/api/test',
      method: 'GET',
      status: 200,
      durationMs: 10,
    })

    expect(infoSpy).toHaveBeenCalledWith('[api] GET /api/test 200 in 10ms')
  })
})

describe('startApiTimer', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns elapsed time in ms', () => {
    const timer = startApiTimer('/api/search', 'GET')

    // Simulate some time passing
    const durationMs = timer.end(200)

    expect(typeof durationMs).toBe('number')
    expect(durationMs).toBeGreaterThanOrEqual(0)
  })

  it('logs timing when end is called', () => {
    const timer = startApiTimer('/api/search', 'GET')
    timer.end(200, { resultCount: 3 })

    expect(infoSpy).toHaveBeenCalledTimes(1)
    const logMessage = infoSpy.mock.calls[0]?.[0] as string
    expect(logMessage).toMatch(/^\[api\] GET \/api\/search 200 in \d+ms/)
    expect(logMessage).toContain('"resultCount":3')
  })

  it('measures actual elapsed time', async () => {
    const timer = startApiTimer('/api/slow', 'POST')

    // Wait a small amount of time
    await new Promise(resolve => setTimeout(resolve, 50))

    const durationMs = timer.end(200)

    // Should be at least 40ms (allowing for timer imprecision)
    expect(durationMs).toBeGreaterThanOrEqual(40)
  })
})
