import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FocusAreaDropdown } from '../FocusAreaDropdown'
import { FocusAreaProvider } from '@/components/providers/FocusAreaProvider'

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

describe('FocusAreaDropdown', () => {
  const mockFocusAreas = [
    { id: 1, name: 'React', color: '#61dafb', createdAt: new Date() },
    { id: 2, name: 'TypeScript', color: '#3178c6', createdAt: new Date() },
    { id: 3, name: 'Next.js', color: '#000000', createdAt: new Date() },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    })
  })

  it('renders pill-shaped trigger button', async () => {
    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      const trigger = screen.getByRole('button')
      expect(trigger).toBeInTheDocument()
      expect(trigger).toHaveClass('rounded-full', 'px-4', 'py-1.5', 'text-sm')
    })
  })

  it('shows "All Areas" by default when no area is selected', async () => {
    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /All Areas/i })).toBeInTheDocument()
    })
  })

  it('shows selected area name when an area is selected', async () => {
    localStorageMock.setItem('gold-miner-focus-area', '1')

    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /React/i })).toBeInTheDocument()
    })
  })

  it('opens dropdown menu when trigger is clicked', async () => {
    const user = userEvent.setup()

    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText('TypeScript')).toBeInTheDocument()
      expect(screen.getByText('Next.js')).toBeInTheDocument()
    })
  })

  it('displays "All" option at the top', async () => {
    const user = userEvent.setup()

    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      const menuItems = screen.getAllByRole('menuitem')
      expect(menuItems[0]).toHaveTextContent('All')
    })
  })

  it('displays separator after "All" option', async () => {
    const user = userEvent.setup()

    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      const separators = screen.getAllByRole('separator')
      expect(separators.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('displays "Manage Focus Areas..." at the bottom', async () => {
    const user = userEvent.setup()

    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      const menuItems = screen.getAllByRole('menuitem')
      const lastItem = menuItems[menuItems.length - 1]
      expect(lastItem).toHaveTextContent('Manage Focus Areas...')
    })
  })

  it('updates context and localStorage when selecting a focus area', async () => {
    const user = userEvent.setup()

    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    // Open dropdown
    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
    })

    // Select React
    await user.click(screen.getByText('React'))

    await waitFor(() => {
      expect(localStorageMock.getItem('gold-miner-focus-area')).toBe('1')
      expect(screen.getByRole('button', { name: /React/i })).toBeInTheDocument()
    })
  })

  it('updates context and localStorage when selecting "All"', async () => {
    const user = userEvent.setup()
    localStorageMock.setItem('gold-miner-focus-area', '2')

    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /TypeScript/i })).toBeInTheDocument()
    })

    // Open dropdown
    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
    })

    // Select All
    await user.click(screen.getByText('All'))

    await waitFor(() => {
      expect(localStorageMock.getItem('gold-miner-focus-area')).toBeNull()
      expect(screen.getByRole('button', { name: /All Areas/i })).toBeInTheDocument()
    })
  })

  it('calls onManageClick when "Manage Focus Areas..." is clicked', async () => {
    const user = userEvent.setup()
    const mockOnManageClick = vi.fn()

    render(
      <FocusAreaProvider>
        <FocusAreaDropdown onManageClick={mockOnManageClick} />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    // Open dropdown
    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Manage Focus Areas...')).toBeInTheDocument()
    })

    // Click manage
    await user.click(screen.getByText('Manage Focus Areas...'))

    await waitFor(() => {
      expect(mockOnManageClick).toHaveBeenCalledTimes(1)
    })
  })

  it('applies muted background styling to trigger button', async () => {
    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      const trigger = screen.getByRole('button')
      expect(trigger).toHaveClass('bg-muted')
    })
  })

  it('renders empty list when no focus areas are available', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: [] }),
    })

    render(
      <FocusAreaProvider>
        <FocusAreaDropdown />
      </FocusAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      const menuItems = screen.getAllByRole('menuitem')
      // Should only have "All" and "Manage Focus Areas..."
      expect(menuItems.length).toBe(2)
    })
  })
})
