import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useURLParams } from '../useURLParams'

// Mock Next.js navigation
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockPathname = '/discovery'
let mockSearchParamsString = ''

// Create stable router instance for referential stability tests
const mockRouter = {
  push: mockPush,
  replace: mockReplace,
}

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useSearchParams: () => ({
    toString: () => mockSearchParamsString,
    get: (key: string) => {
      const params = new URLSearchParams(mockSearchParamsString)
      return params.get(key)
    },
  }),
}))

describe('useURLParams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParamsString = ''
    // Mock window.location.search for the implementation to read from
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })
  })

  it('should return searchParams that can read URL parameters', () => {
    mockSearchParamsString = 'channel=abc&type=saved'

    const { result } = renderHook(() => useURLParams())

    expect(result.current.searchParams.get('channel')).toBe('abc')
    expect(result.current.searchParams.get('type')).toBe('saved')
  })

  it('should return null for non-existent parameters', () => {
    mockSearchParamsString = ''

    const { result } = renderHook(() => useURLParams())

    expect(result.current.searchParams.get('channel')).toBe(null)
    expect(result.current.searchParams.get('type')).toBe(null)
  })

  it('should call router.replace when updateParams is called with default method', () => {
    mockSearchParamsString = ''

    const { result } = renderHook(() => useURLParams())

    result.current.updateParams({ channel: 'UCtest' })

    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/discovery?channel=UCtest')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should call router.push when updateParams is called with push method', () => {
    mockSearchParamsString = 'page=1'
    Object.defineProperty(window, 'location', {
      value: { search: '?page=1' },
      writable: true,
    })

    const { result } = renderHook(() => useURLParams())

    result.current.updateParams({ page: '2' }, 'push')

    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/discovery?page=2')
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('should remove parameter when value is null', () => {
    mockSearchParamsString = 'channel=abc&page=2'
    Object.defineProperty(window, 'location', {
      value: { search: '?channel=abc&page=2' },
      writable: true,
    })

    const { result } = renderHook(() => useURLParams())

    result.current.updateParams({ page: null })

    expect(mockReplace).toHaveBeenCalledWith('/discovery?channel=abc')
  })

  it('should remove parameter when value is empty string', () => {
    mockSearchParamsString = 'channel=abc&page=2'
    Object.defineProperty(window, 'location', {
      value: { search: '?channel=abc&page=2' },
      writable: true,
    })

    const { result } = renderHook(() => useURLParams())

    result.current.updateParams({ page: '' })

    expect(mockReplace).toHaveBeenCalledWith('/discovery?channel=abc')
  })

  it('should update multiple parameters at once', () => {
    mockSearchParamsString = 'channel=abc'
    Object.defineProperty(window, 'location', {
      value: { search: '?channel=abc' },
      writable: true,
    })

    const { result } = renderHook(() => useURLParams())

    result.current.updateParams({ type: 'saved', page: '3' })

    expect(mockReplace).toHaveBeenCalledWith('/discovery?channel=abc&type=saved&page=3')
  })

  it('should navigate to pathname without query string when all params are removed', () => {
    mockSearchParamsString = 'channel=abc'
    Object.defineProperty(window, 'location', {
      value: { search: '?channel=abc' },
      writable: true,
    })

    const { result } = renderHook(() => useURLParams())

    result.current.updateParams({ channel: null })

    expect(mockReplace).toHaveBeenCalledWith('/discovery')
  })

  it('should preserve existing params when adding new ones', () => {
    mockSearchParamsString = 'channel=abc&type=saved'
    Object.defineProperty(window, 'location', {
      value: { search: '?channel=abc&type=saved' },
      writable: true,
    })

    const { result } = renderHook(() => useURLParams())

    result.current.updateParams({ page: '2' })

    expect(mockReplace).toHaveBeenCalledWith('/discovery?channel=abc&type=saved&page=2')
  })

  it('should replace existing param value when updating', () => {
    mockSearchParamsString = 'channel=abc&type=saved'
    Object.defineProperty(window, 'location', {
      value: { search: '?channel=abc&type=saved' },
      writable: true,
    })

    const { result } = renderHook(() => useURLParams())

    result.current.updateParams({ type: 'not-saved' })

    expect(mockReplace).toHaveBeenCalledWith('/discovery?channel=abc&type=not-saved')
  })

  it('should maintain referential stability of updateParams across navigation changes', () => {
    // Mock window.location.search for the implementation to read from
    Object.defineProperty(window, 'location', {
      value: { search: '?channel=abc' },
      writable: true,
    })

    // Start with initial search params
    mockSearchParamsString = 'channel=abc'

    const { result, rerender } = renderHook(() => useURLParams())

    // Capture the initial updateParams reference
    const initialUpdateParams = result.current.updateParams

    // Simulate navigation that changes searchParams
    mockSearchParamsString = 'channel=abc&page=2'
    Object.defineProperty(window, 'location', {
      value: { search: '?channel=abc&page=2' },
      writable: true,
    })

    // Re-render the hook with new searchParams
    rerender()

    // The updateParams reference should remain the same
    expect(result.current.updateParams).toBe(initialUpdateParams)
  })
})
