import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch for Google Fonts
const mockFontArrayBuffer = new ArrayBuffer(8)
const mockCss = `
@font-face {
  font-family: 'Inter';
  src: url(https://fonts.gstatic.com/s/inter/v18/abc.ttf) format('truetype');
}
`

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('fonts.googleapis.com')) {
      return Promise.resolve({
        text: () => Promise.resolve(mockCss),
      })
    }
    if (url.includes('fonts.gstatic.com')) {
      return Promise.resolve({
        arrayBuffer: () => Promise.resolve(mockFontArrayBuffer),
      })
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`))
  }))
})

// Import after mocking
const { default: Image, alt, size, contentType } = await import('../opengraph-image')

describe('opengraph-image', () => {
  it('exports correct metadata', () => {
    expect(alt).toBe('Sluice — Turn YouTube into a Knowledge Bank')
    expect(size).toEqual({ width: 1200, height: 630 })
    expect(contentType).toBe('image/png')
  })

  it('returns an ImageResponse', async () => {
    const response = await Image()
    expect(response).toBeDefined()
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.status).toBe(200)
  })

  it('fetches Inter Bold (700) and Inter Regular (400) fonts from Google Fonts', async () => {
    await Image()

    const fetchCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls
    const cssUrls = fetchCalls
      .map((args: unknown[]) => args[0] as string)
      .filter((url: string) => url.includes('fonts.googleapis.com'))

    expect(cssUrls).toHaveLength(2)
    expect(cssUrls[0]).toContain('family=Inter')
    expect(cssUrls[0]).toContain('wght@700')
    expect(cssUrls[1]).toContain('family=Inter')
    expect(cssUrls[1]).toContain('wght@400')
  })
})
