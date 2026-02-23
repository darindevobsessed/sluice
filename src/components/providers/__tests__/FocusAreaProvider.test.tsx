import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { FocusAreaProvider, useFocusArea } from '../FocusAreaProvider'
import { SidebarDataProvider } from '../SidebarDataProvider'
import type { FocusArea } from '@/lib/db/schema'

// Mock fetch (SidebarDataProvider fetches /api/sidebar)
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Helper: renders FocusAreaProvider inside SidebarDataProvider with a given focusAreas list
function renderWithProviders(
  children: React.ReactNode,
  focusAreas: FocusArea[] = [],
) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ channels: [], focusAreas }),
  })

  return render(
    <SidebarDataProvider>
      <FocusAreaProvider>
        {children}
      </FocusAreaProvider>
    </SidebarDataProvider>
  )
}

// Test component that uses the context
function TestComponent() {
  const { focusAreas, selectedFocusAreaId, setSelectedFocusAreaId, isLoading } = useFocusArea()

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <div data-testid="focus-areas-count">{focusAreas.length}</div>
      <div data-testid="selected-id">{selectedFocusAreaId ?? 'null'}</div>
      <button onClick={() => setSelectedFocusAreaId(1)}>Select 1</button>
      <button onClick={() => setSelectedFocusAreaId(null)}>Select All</button>
    </div>
  )
}

describe('FocusAreaProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  it('reads focus areas from SidebarDataProvider (no separate fetch)', async () => {
    const mockFocusAreas: FocusArea[] = [
      { id: 1, name: 'React', color: '#61dafb', createdAt: new Date('2024-01-01') },
      { id: 2, name: 'TypeScript', color: '#3178c6', createdAt: new Date('2024-01-01') },
    ]

    renderWithProviders(<TestComponent />, mockFocusAreas)

    await waitFor(() => {
      expect(screen.getByTestId('focus-areas-count').textContent).toBe('2')
    })

    // Should only fetch /api/sidebar once (no separate /api/focus-areas call)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/sidebar')
  })

  it('does NOT fetch /api/focus-areas', async () => {
    renderWithProviders(<TestComponent />, [])

    await waitFor(() => {
      expect(screen.getByTestId('focus-areas-count').textContent).toBe('0')
    })

    const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).not.toContain('/api/focus-areas')
  })

  it('defaults selectedFocusAreaId to null', async () => {
    renderWithProviders(<TestComponent />, [])

    await waitFor(() => {
      expect(screen.getByTestId('selected-id').textContent).toBe('null')
    })
  })

  it('loads selectedFocusAreaId from localStorage', async () => {
    localStorageMock.setItem('sluice-focus-area', '5')

    renderWithProviders(<TestComponent />, [])

    await waitFor(() => {
      expect(screen.getByTestId('selected-id').textContent).toBe('5')
    })
  })

  it('persists selectedFocusAreaId to localStorage when changed', async () => {
    renderWithProviders(<TestComponent />, [])

    await waitFor(() => {
      expect(screen.getByText('Select 1')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('Select 1').click()
    })

    await waitFor(() => {
      expect(localStorageMock.getItem('sluice-focus-area')).toBe('1')
    })
  })

  it('removes from localStorage when set to null', async () => {
    localStorageMock.setItem('sluice-focus-area', '3')

    renderWithProviders(<TestComponent />, [])

    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('Select All').click()
    })

    await waitFor(() => {
      expect(localStorageMock.getItem('sluice-focus-area')).toBeNull()
    })
  })

  it('reflects focusArea updates after sidebar refetch', async () => {
    const initialFocusAreas: FocusArea[] = [
      { id: 1, name: 'React', color: '#61dafb', createdAt: new Date('2024-01-01') },
    ]

    // First render: 1 focus area
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channels: [], focusAreas: initialFocusAreas }),
    })

    function RefetchComponent() {
      const { focusAreas, isLoading, refetch } = useFocusArea()

      if (isLoading) return <div>Loading...</div>

      return (
        <div>
          <div data-testid="focus-areas-count">{focusAreas.length}</div>
          <button onClick={() => refetch()}>Refetch</button>
        </div>
      )
    }

    render(
      <SidebarDataProvider>
        <FocusAreaProvider>
          <RefetchComponent />
        </FocusAreaProvider>
      </SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('focus-areas-count').textContent).toBe('1')
    })

    // Queue updated sidebar response with 2 focus areas
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [],
        focusAreas: [
          { id: 1, name: 'React', color: '#61dafb', createdAt: new Date('2024-01-01') },
          { id: 2, name: 'TypeScript', color: '#3178c6', createdAt: new Date('2024-01-02') },
        ],
      }),
    })

    act(() => {
      screen.getByText('Refetch').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('focus-areas-count').textContent).toBe('2')
    })
  })

  it('handles fetch errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(
      <SidebarDataProvider>
        <FocusAreaProvider>
          <TestComponent />
        </FocusAreaProvider>
      </SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('focus-areas-count').textContent).toBe('0')
    })

    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
