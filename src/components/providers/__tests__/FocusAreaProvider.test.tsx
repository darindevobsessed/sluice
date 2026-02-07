import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { FocusAreaProvider, useFocusArea } from '../FocusAreaProvider'

// Mock fetch
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

  it('loads focus areas on mount', async () => {
    const mockFocusAreas = [
      { id: 1, name: 'React', color: '#61dafb', createdAt: new Date() },
      { id: 2, name: 'TypeScript', color: '#3178c6', createdAt: new Date() },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    })

    render(
      <FocusAreaProvider>
        <TestComponent />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('focus-areas-count').textContent).toBe('2')
    })
  })

  it('defaults selectedFocusAreaId to null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: [] }),
    })

    render(
      <FocusAreaProvider>
        <TestComponent />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('selected-id').textContent).toBe('null')
    })
  })

  it('loads selectedFocusAreaId from localStorage', async () => {
    localStorageMock.setItem('gold-miner-focus-area', '5')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: [] }),
    })

    render(
      <FocusAreaProvider>
        <TestComponent />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('selected-id').textContent).toBe('5')
    })
  })

  it('persists selectedFocusAreaId to localStorage when changed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: [] }),
    })

    render(
      <FocusAreaProvider>
        <TestComponent />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Select 1')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('Select 1').click()
    })

    await waitFor(() => {
      expect(localStorageMock.getItem('gold-miner-focus-area')).toBe('1')
    })
  })

  it('removes from localStorage when set to null', async () => {
    localStorageMock.setItem('gold-miner-focus-area', '3')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: [] }),
    })

    render(
      <FocusAreaProvider>
        <TestComponent />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('Select All').click()
    })

    await waitFor(() => {
      expect(localStorageMock.getItem('gold-miner-focus-area')).toBeNull()
    })
  })

  it('handles fetch errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(
      <FocusAreaProvider>
        <TestComponent />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('focus-areas-count').textContent).toBe('0')
    })

    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
