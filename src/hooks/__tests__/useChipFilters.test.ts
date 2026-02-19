import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChipFilters } from '../useChipFilters'
import type { VideoListItem } from '@/lib/db/search'
import type { FocusArea } from '@/lib/db/schema'

// --- Mock next/navigation ---
const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => '/',
}))

// --- Fixtures ---
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)

const mockVideos: VideoListItem[] = [
  {
    id: 1,
    youtubeId: 'a',
    sourceType: 'youtube',
    title: 'Short Recent',
    channel: 'Fireship',
    thumbnail: null,
    duration: 120,
    description: null,
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo,
    publishedAt: null,
  },
  {
    id: 2,
    youtubeId: 'b',
    sourceType: 'youtube',
    title: 'Long Old',
    channel: 'ThePrimeagen',
    thumbnail: null,
    duration: 3600,
    description: null,
    createdAt: tenDaysAgo,
    updatedAt: tenDaysAgo,
    publishedAt: null,
  },
  {
    id: 3,
    youtubeId: 'c',
    sourceType: 'youtube',
    title: 'Medium Recent',
    channel: 'Fireship',
    thumbnail: null,
    duration: 600,
    description: null,
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo,
    publishedAt: null,
  },
]

const mockFocusAreas: FocusArea[] = [
  { id: 10, name: 'TypeScript', color: '#3178c6', createdAt: new Date() },
  { id: 20, name: 'Performance', color: '#ff6b35', createdAt: new Date() },
]

// Video 1 belongs to focus area 10 (TypeScript)
// Video 3 belongs to focus areas 10 and 20
const mockFocusAreaMap: Record<number, Array<Pick<FocusArea, 'id' | 'name' | 'color'>>> = {
  1: [{ id: 10, name: 'TypeScript', color: '#3178c6' }],
  3: [
    { id: 10, name: 'TypeScript', color: '#3178c6' },
    { id: 20, name: 'Performance', color: '#ff6b35' },
  ],
}

const defaultOptions = {
  videos: mockVideos,
  focusAreas: mockFocusAreas,
  focusAreaMap: mockFocusAreaMap,
}

describe('useChipFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    // Reset window.location for useURLParams
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })
  })

  // Test 1: generates static chips plus focus area chips
  it('generates static chips plus focus area chips', () => {
    const { result } = renderHook(() => useChipFilters(defaultOptions))

    const { chips } = result.current

    // Static chips must be present
    const staticIds = chips.map(c => c.id)
    expect(staticIds).toContain('all')
    expect(staticIds).toContain('recent')
    expect(staticIds).toContain('duration-short')
    expect(staticIds).toContain('duration-medium')
    expect(staticIds).toContain('duration-long')

    // Focus area chips must be present
    expect(staticIds).toContain('focus:10')
    expect(staticIds).toContain('focus:20')

    // Labels are correct
    const allChip = chips.find(c => c.id === 'all')!
    expect(allChip.label).toBe('All')

    const tsChip = chips.find(c => c.id === 'focus:10')!
    expect(tsChip.label).toBe('TypeScript')
    expect(tsChip.group).toBe('focus')
  })

  // Test 2: returns all videos when no chips are active
  it('returns all videos when no chips are active', () => {
    const { result } = renderHook(() => useChipFilters(defaultOptions))

    expect(result.current.activeIds.size).toBe(0)
    expect(result.current.filteredVideos).toEqual(mockVideos)
  })

  // Test 3: filters by duration-short
  it('filters by duration-short chip', () => {
    mockSearchParams = new URLSearchParams('chips=duration-short')
    Object.defineProperty(window, 'location', {
      value: { search: '?chips=duration-short' },
      writable: true,
    })

    const { result } = renderHook(() => useChipFilters(defaultOptions))

    expect(result.current.activeIds).toEqual(new Set(['duration-short']))
    // Video 1 (120s) is short; Video 2 (3600s) is long; Video 3 (600s) is medium
    expect(result.current.filteredVideos).toHaveLength(1)
    expect(result.current.filteredVideos[0]!.id).toBe(1)
  })

  // Test 4: OR logic within same group (two duration chips)
  it('uses OR logic within same group — short + long shows both', () => {
    mockSearchParams = new URLSearchParams('chips=duration-short,duration-long')
    Object.defineProperty(window, 'location', {
      value: { search: '?chips=duration-short,duration-long' },
      writable: true,
    })

    const { result } = renderHook(() => useChipFilters(defaultOptions))

    // Video 1 (short) and Video 2 (long) pass; Video 3 (medium) does not
    expect(result.current.filteredVideos).toHaveLength(2)
    const ids = result.current.filteredVideos.map(v => v.id)
    expect(ids).toContain(1)
    expect(ids).toContain(2)
    expect(ids).not.toContain(3)
  })

  // Test 5: filters by recent (last 7 days)
  it('filters by recent chip to last 7 days only', () => {
    mockSearchParams = new URLSearchParams('chips=recent')
    Object.defineProperty(window, 'location', {
      value: { search: '?chips=recent' },
      writable: true,
    })

    const { result } = renderHook(() => useChipFilters(defaultOptions))

    // Videos 1 and 3 are 2 days old (recent); Video 2 is 10 days old (not recent)
    expect(result.current.filteredVideos).toHaveLength(2)
    const ids = result.current.filteredVideos.map(v => v.id)
    expect(ids).toContain(1)
    expect(ids).toContain(3)
    expect(ids).not.toContain(2)
  })

  // Test 6: filters by focus area
  it('filters by focus area chip', () => {
    mockSearchParams = new URLSearchParams('chips=focus:10')
    Object.defineProperty(window, 'location', {
      value: { search: '?chips=focus:10' },
      writable: true,
    })

    const { result } = renderHook(() => useChipFilters(defaultOptions))

    // Videos 1 and 3 are in focus area 10; Video 2 is not
    expect(result.current.filteredVideos).toHaveLength(2)
    const ids = result.current.filteredVideos.map(v => v.id)
    expect(ids).toContain(1)
    expect(ids).toContain(3)
    expect(ids).not.toContain(2)
  })

  // Test 7: AND logic across groups (duration + focus)
  it('uses AND logic across groups — duration-short + focus:10 shows only short TypeScript videos', () => {
    mockSearchParams = new URLSearchParams('chips=duration-short,focus:10')
    Object.defineProperty(window, 'location', {
      value: { search: '?chips=duration-short,focus:10' },
      writable: true,
    })

    const { result } = renderHook(() => useChipFilters(defaultOptions))

    // Video 1 (short AND in focus:10) passes
    // Video 2 (long, not in focus:10) fails both groups
    // Video 3 (medium, in focus:10) fails duration group
    expect(result.current.filteredVideos).toHaveLength(1)
    expect(result.current.filteredVideos[0]!.id).toBe(1)
  })

  // Test 8: toggling 'all' clears all active chips
  it('toggling all clears all active chips', () => {
    mockSearchParams = new URLSearchParams('chips=duration-short,focus:10')
    Object.defineProperty(window, 'location', {
      value: { search: '?chips=duration-short,focus:10' },
      writable: true,
    })

    const { result } = renderHook(() => useChipFilters(defaultOptions))

    act(() => {
      result.current.handleToggle('all')
    })

    // Should call router.replace with chips param removed
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  // Test 9: toggling a chip adds it to active set
  it('toggling an inactive chip activates it and updates URL', () => {
    mockSearchParams = new URLSearchParams()
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })

    const { result } = renderHook(() => useChipFilters(defaultOptions))

    act(() => {
      result.current.handleToggle('duration-short')
    })

    expect(mockReplace).toHaveBeenCalledWith('/?chips=duration-short')
  })

  // Test 10: toggling an active chip removes it
  it('toggling an active chip deactivates it', () => {
    mockSearchParams = new URLSearchParams('chips=duration-short,duration-long')
    Object.defineProperty(window, 'location', {
      value: { search: '?chips=duration-short,duration-long' },
      writable: true,
    })

    const { result } = renderHook(() => useChipFilters(defaultOptions))

    act(() => {
      result.current.handleToggle('duration-short')
    })

    expect(mockReplace).toHaveBeenCalledWith('/?chips=duration-long')
  })
})
