import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, renderHook, act } from '@testing-library/react'
import type { FocusArea } from '@/lib/db/schema'
import { SidebarDataProvider, useSidebarData } from '../SidebarDataProvider'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SidebarDataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useSidebarData hook', () => {
    it('throws error when used outside provider', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useSidebarData())
      }).toThrow('useSidebarData must be used within a SidebarDataProvider')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('initial state', () => {
    it('starts with isLoading=true, empty channels, and empty focusAreas', () => {
      // Never resolves — keep in loading state
      mockFetch.mockReturnValue(new Promise(() => {}))

      const { result } = renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.channels).toEqual([])
      expect(result.current.focusAreas).toEqual([])
    })

    it('provides a refetch function', () => {
      mockFetch.mockReturnValue(new Promise(() => {}))

      const { result } = renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      expect(typeof result.current.refetch).toBe('function')
    })
  })

  describe('data fetching', () => {
    it('fetches from /api/sidebar on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channels: [], focusAreas: [] }),
      })

      renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/sidebar')
      })
    })

    it('populates channels from API response', async () => {
      const mockChannels = [
        { name: 'Fireship', videoCount: 12 },
        { name: 'Theo', videoCount: 8 },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channels: mockChannels, focusAreas: [] }),
      })

      const { result } = renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      await waitFor(() => {
        expect(result.current.channels).toEqual(mockChannels)
      })
    })

    it('populates focusAreas from API response', async () => {
      const mockFocusAreas: FocusArea[] = [
        { id: 1, name: 'React', color: '#61dafb', createdAt: new Date('2024-01-01') },
        { id: 2, name: 'TypeScript', color: '#3178c6', createdAt: new Date('2024-01-01') },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channels: [], focusAreas: mockFocusAreas }),
      })

      const { result } = renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      await waitFor(() => {
        expect(result.current.focusAreas).toEqual(mockFocusAreas)
      })
    })

    it('defaults focusAreas to empty array when missing from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channels: [] }),
      })

      const { result } = renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      await waitFor(() => {
        expect(result.current.focusAreas).toEqual([])
      })
    })

    it('sets isLoading=false after fetch completes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channels: [], focusAreas: [] }),
      })

      const { result } = renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('sets isLoading=false even when channels is undefined in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ focusAreas: [] }),
      })

      const { result } = renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.channels).toEqual([])
      })
    })

    it('handles non-ok response gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const { result } = renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.channels).toEqual([])
      })

      consoleErrorSpy.mockRestore()
    })

    it('handles fetch errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.channels).toEqual([])
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })

  describe('refetch', () => {
    it('re-fetches channel and focusArea data when refetch is called', async () => {
      const firstChannels = [{ name: 'Fireship', videoCount: 12 }]
      const firstFocusAreas: FocusArea[] = [
        { id: 1, name: 'React', color: '#61dafb', createdAt: new Date('2024-01-01') },
      ]
      const secondChannels = [
        { name: 'Fireship', videoCount: 13 },
        { name: 'Theo', videoCount: 8 },
      ]
      const secondFocusAreas: FocusArea[] = [
        { id: 1, name: 'React', color: '#61dafb', createdAt: new Date('2024-01-01') },
        { id: 2, name: 'TypeScript', color: '#3178c6', createdAt: new Date('2024-01-02') },
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ channels: firstChannels, focusAreas: firstFocusAreas }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ channels: secondChannels, focusAreas: secondFocusAreas }),
        })

      const { result } = renderHook(() => useSidebarData(), {
        wrapper: SidebarDataProvider,
      })

      await waitFor(() => {
        expect(result.current.channels).toEqual(firstChannels)
        expect(result.current.focusAreas).toEqual(firstFocusAreas)
      })

      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.channels).toEqual(secondChannels)
      expect(result.current.focusAreas).toEqual(secondFocusAreas)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('children rendering', () => {
    it('renders children correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channels: [] }),
      })

      render(
        <SidebarDataProvider>
          <div data-testid="test-child">Test Child</div>
        </SidebarDataProvider>
      )

      expect(screen.getByTestId('test-child')).toBeInTheDocument()
    })
  })

  describe('TestConsumer integration', () => {
    function TestConsumer() {
      const { channels, isLoading, refetch } = useSidebarData()

      if (isLoading) return <div>Loading...</div>

      return (
        <div>
          <div data-testid="channel-count">{channels.length}</div>
          <div data-testid="first-channel">{channels[0]?.name ?? 'none'}</div>
          <button onClick={() => refetch()}>Refetch</button>
        </div>
      )
    }

    it('shows loading state initially', () => {
      mockFetch.mockReturnValue(new Promise(() => {}))

      render(
        <SidebarDataProvider>
          <TestConsumer />
        </SidebarDataProvider>
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('shows channel data after load', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          channels: [
            { name: 'Fireship', videoCount: 12 },
            { name: 'Theo', videoCount: 8 },
          ],
        }),
      })

      render(
        <SidebarDataProvider>
          <TestConsumer />
        </SidebarDataProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('channel-count').textContent).toBe('2')
        expect(screen.getByTestId('first-channel').textContent).toBe('Fireship')
      })
    })
  })
})
