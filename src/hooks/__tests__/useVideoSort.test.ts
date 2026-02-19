import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVideoSort, SORT_OPTIONS } from '../useVideoSort'
import type { Video } from '@/lib/db/schema'

const mockReplace = vi.fn()
let mockSearchParamsString = ''

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => {
    const params = new URLSearchParams(mockSearchParamsString)
    return {
      toString: () => mockSearchParamsString,
      get: (key: string) => params.get(key),
    }
  },
}))

const now = new Date('2026-02-18T12:00:00Z')
const yesterday = new Date('2026-02-17T12:00:00Z')
const lastWeek = new Date('2026-02-11T12:00:00Z')

const mockVideos: Video[] = [
  {
    id: 1,
    youtubeId: 'a',
    sourceType: 'youtube',
    title: 'Zebra Talk',
    channel: 'Ch1',
    thumbnail: null,
    duration: 3600,
    description: null,
    transcript: 't',
    createdAt: yesterday,
    updatedAt: yesterday,
    publishedAt: lastWeek,
  },
  {
    id: 2,
    youtubeId: 'b',
    sourceType: 'youtube',
    title: 'Alpha Guide',
    channel: 'Ch2',
    thumbnail: null,
    duration: 120,
    description: null,
    transcript: 't',
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
  {
    id: 3,
    youtubeId: 'c',
    sourceType: 'transcript',
    title: 'Mango Recipe',
    channel: null,
    thumbnail: null,
    duration: null,
    description: null,
    transcript: 't',
    createdAt: lastWeek,
    updatedAt: lastWeek,
    publishedAt: null,
  },
]

describe('useVideoSort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParamsString = ''
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })
  })

  it('defaults to "added" sort when no URL param', () => {
    const { result } = renderHook(() => useVideoSort({ videos: mockVideos }))
    expect(result.current.sortOption).toBe('added')
  })

  it('reads sort from URL param', () => {
    mockSearchParamsString = 'sort=title'
    const { result } = renderHook(() => useVideoSort({ videos: mockVideos }))
    expect(result.current.sortOption).toBe('title')
  })

  it('falls back to "added" for invalid sort param', () => {
    mockSearchParamsString = 'sort=bogus'
    const { result } = renderHook(() => useVideoSort({ videos: mockVideos }))
    expect(result.current.sortOption).toBe('added')
  })

  it('sorts by createdAt descending for "added"', () => {
    const { result } = renderHook(() => useVideoSort({ videos: mockVideos }))
    const titles = result.current.sortedVideos.map(v => v.title)
    // now > yesterday > lastWeek
    expect(titles).toEqual(['Alpha Guide', 'Zebra Talk', 'Mango Recipe'])
  })

  it('sorts by publishedAt descending for "published", nulls last', () => {
    mockSearchParamsString = 'sort=published'
    const { result } = renderHook(() => useVideoSort({ videos: mockVideos }))
    const titles = result.current.sortedVideos.map(v => v.title)
    // now > lastWeek > null
    expect(titles).toEqual(['Alpha Guide', 'Zebra Talk', 'Mango Recipe'])
  })

  it('sorts by duration ascending for "duration", nulls last', () => {
    mockSearchParamsString = 'sort=duration'
    const { result } = renderHook(() => useVideoSort({ videos: mockVideos }))
    const titles = result.current.sortedVideos.map(v => v.title)
    // 120 < 3600 < null
    expect(titles).toEqual(['Alpha Guide', 'Zebra Talk', 'Mango Recipe'])
  })

  it('sorts by title A-Z case-insensitive for "title"', () => {
    mockSearchParamsString = 'sort=title'
    const { result } = renderHook(() => useVideoSort({ videos: mockVideos }))
    const titles = result.current.sortedVideos.map(v => v.title)
    expect(titles).toEqual(['Alpha Guide', 'Mango Recipe', 'Zebra Talk'])
  })

  it('setSortOption updates URL param', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })
    const { result } = renderHook(() => useVideoSort({ videos: mockVideos }))
    act(() => {
      result.current.setSortOption('title')
    })
    expect(mockReplace).toHaveBeenCalledWith('/?sort=title')
  })

  it('setSortOption removes param when setting to "added" (default)', () => {
    mockSearchParamsString = 'sort=title'
    Object.defineProperty(window, 'location', {
      value: { search: '?sort=title' },
      writable: true,
    })
    const { result } = renderHook(() => useVideoSort({ videos: mockVideos }))
    act(() => {
      result.current.setSortOption('added')
    })
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('exports SORT_OPTIONS with correct shape', () => {
    expect(SORT_OPTIONS).toHaveLength(4)
    expect(SORT_OPTIONS[0]).toEqual({ id: 'added', label: 'Date Added' })
    expect(SORT_OPTIONS[3]).toEqual({ id: 'title', label: 'Title A-Z' })
  })

  it('does not mutate the input videos array', () => {
    const original = [...mockVideos]
    renderHook(() => useVideoSort({ videos: mockVideos }))
    expect(mockVideos).toEqual(original)
  })
})
