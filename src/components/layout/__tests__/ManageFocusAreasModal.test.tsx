import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManageFocusAreasModal } from '../ManageFocusAreasModal'
import { FocusAreaProvider } from '@/components/providers/FocusAreaProvider'
import { SidebarDataProvider } from '@/components/providers/SidebarDataProvider'

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

// Mock window.confirm
global.confirm = vi.fn()

describe('ManageFocusAreasModal', () => {
  const mockFocusAreas = [
    { id: 1, name: 'React', color: '#61dafb', createdAt: new Date() },
    { id: 2, name: 'TypeScript', color: '#3178c6', createdAt: new Date() },
    { id: 3, name: 'AI & ML', color: '#ff6b6b', createdAt: new Date() },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    })
  })

  it('renders modal title "Manage Focus Areas"', async () => {
    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Manage Focus Areas')).toBeInTheDocument()
    })
  })

  it('displays list of existing focus areas', async () => {
    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText('TypeScript')).toBeInTheDocument()
      expect(screen.getByText('AI & ML')).toBeInTheDocument()
    })
  })

  it('displays empty state when no focus areas exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: [] }),
    })

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/No focus areas yet/i)).toBeInTheDocument()
    })
  })

  it('displays rename and delete buttons for each focus area', async () => {
    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
      expect(editButtons.length).toBe(3)
      expect(deleteButtons.length).toBe(3)
    })
  })

  it('displays add focus area input and button', async () => {
    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/New focus area name/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument()
    })
  })

  it('creates new focus area when Add button is clicked', async () => {
    const user = userEvent.setup()

    // Mock POST response for create
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusArea: { id: 4, name: 'Vue.js', color: null, createdAt: new Date() } }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: [...mockFocusAreas, { id: 4, name: 'Vue.js', color: null, createdAt: new Date() }] }),
    })

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/New focus area name/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/New focus area name/i)
    const addButton = screen.getByRole('button', { name: /Add/i })

    await user.type(input, 'Vue.js')
    await user.click(addButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/focus-areas',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Vue.js' }),
        })
      )
    })
  })

  it('clears input after successful create', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusArea: { id: 4, name: 'Vue.js', color: null, createdAt: new Date() } }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: [...mockFocusAreas, { id: 4, name: 'Vue.js', color: null, createdAt: new Date() }] }),
    })

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/New focus area name/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/New focus area name/i) as HTMLInputElement
    const addButton = screen.getByRole('button', { name: /Add/i })

    await user.type(input, 'Vue.js')
    await user.click(addButton)

    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  it('trims whitespace from focus area name', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusArea: { id: 4, name: 'Vue.js', color: null, createdAt: new Date() } }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    })

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/New focus area name/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/New focus area name/i)
    const addButton = screen.getByRole('button', { name: /Add/i })

    await user.type(input, '  Vue.js  ')
    await user.click(addButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/focus-areas',
        expect.objectContaining({
          body: JSON.stringify({ name: 'Vue.js' }),
        })
      )
    })
  })

  it('does not create focus area when name is empty', async () => {
    const user = userEvent.setup()

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument()
    })

    const addButton = screen.getByRole('button', { name: /Add/i })
    await user.click(addButton)

    // Should not call POST if called, it would be at index 1 (0 is GET)
    expect(mockFetch).toHaveBeenCalledTimes(1) // Only the initial GET
  })

  it('enters edit mode when edit button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    await user.click(editButtons[0]!)

    await waitFor(() => {
      const input = screen.getByDisplayValue('React')
      expect(input).toBeInTheDocument()
    })
  })

  it('saves renamed focus area when save button is clicked in edit mode', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusArea: { id: 1, name: 'React 19', color: '#61dafb', createdAt: new Date() } }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: [{ id: 1, name: 'React 19', color: '#61dafb', createdAt: new Date() }, ...mockFocusAreas.slice(1)] }),
    })

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    await user.click(editButtons[0]!)

    await waitFor(() => {
      expect(screen.getByDisplayValue('React')).toBeInTheDocument()
    })

    const input = screen.getByDisplayValue('React')
    await user.clear(input)
    await user.type(input, 'React 19')

    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/focus-areas/1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'React 19' }),
        })
      )
    })
  })

  it('cancels edit mode when cancel button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    await user.click(editButtons[0]!)

    await waitFor(() => {
      expect(screen.getByDisplayValue('React')).toBeInTheDocument()
    })

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('React')).not.toBeInTheDocument()
    })
  })

  it('shows confirmation dialog when delete button is clicked', async () => {
    const user = userEvent.setup()
    const mockConfirm = vi.mocked(global.confirm)
    mockConfirm.mockReturnValue(false)

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0]!)

    expect(mockConfirm).toHaveBeenCalledWith('Delete "React"?')
  })

  it('deletes focus area when confirmed', async () => {
    const user = userEvent.setup()
    const mockConfirm = vi.mocked(global.confirm)
    mockConfirm.mockReturnValue(true)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    }).mockResolvedValueOnce({
      ok: true,
      status: 204,
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas.slice(1) }),
    })

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0]!)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/focus-areas/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  it('does not delete focus area when cancelled', async () => {
    const user = userEvent.setup()
    const mockConfirm = vi.mocked(global.confirm)
    mockConfirm.mockReturnValue(false)

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0]!)

    // Only initial GET should be called
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('resets selected focus area to "All" when deleting currently selected area', async () => {
    const user = userEvent.setup()
    const mockConfirm = vi.mocked(global.confirm)
    mockConfirm.mockReturnValue(true)
    localStorageMock.setItem('sluice-focus-area', '1')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    }).mockResolvedValueOnce({
      ok: true,
      status: 204,
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas.slice(1) }),
    })

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0]!)

    await waitFor(() => {
      expect(localStorageMock.getItem('sluice-focus-area')).toBeNull()
    })
  })

  it('calls onOpenChange when modal is closed', async () => {
    const mockOnOpenChange = vi.fn()

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={mockOnOpenChange} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Manage Focus Areas')).toBeInTheDocument()
    })

    const closeButton = screen.getByRole('button', { name: /close/i })
    await userEvent.click(closeButton)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('displays loading state during mutations', async () => {
    const user = userEvent.setup()

    // Delay the POST response to simulate loading
    let resolvePost: (value: unknown) => void
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ focusAreas: mockFocusAreas }),
    }).mockReturnValueOnce(postPromise as Promise<Response>)

    render(
      <SidebarDataProvider><FocusAreaProvider>
        <ManageFocusAreasModal open={true} onOpenChange={() => {}} />
      </FocusAreaProvider></SidebarDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/New focus area name/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/New focus area name/i)
    const addButton = screen.getByRole('button', { name: /Add/i })

    await user.type(input, 'Vue.js')
    await user.click(addButton)

    // Check for disabled state or loading indicator
    await waitFor(() => {
      expect(addButton).toBeDisabled()
    })

    // Resolve the promise
    resolvePost!({
      ok: true,
      json: async () => ({ focusArea: { id: 4, name: 'Vue.js', color: null, createdAt: new Date() } }),
    })
  })
})
