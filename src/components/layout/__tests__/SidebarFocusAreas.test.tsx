import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { SidebarFocusAreas } from '../SidebarFocusAreas'
import type { FocusArea } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Type helpers for mock return values
// ---------------------------------------------------------------------------

interface FocusAreaReturn {
  focusAreas: FocusArea[]
  selectedFocusAreaId: number | null
  setSelectedFocusAreaId: (id: number | null) => void
  refetch: () => Promise<void>
  isLoading: boolean
}

interface SidebarReturn {
  collapsed: boolean
  toggleSidebar: () => void
  mobileOpen: boolean
  toggleMobile: () => void
  closeMobile: () => void
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/navigation
const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

// Mock useFocusArea — typed explicitly to avoid inferred `never[]` for focusAreas
const mockSetSelectedFocusAreaId = vi.fn()
const mockUseFocusArea = vi.fn<() => FocusAreaReturn>(() => ({
  focusAreas: [],
  selectedFocusAreaId: null,
  setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
  refetch: vi.fn(),
  isLoading: false,
}))

vi.mock('@/components/providers/FocusAreaProvider', () => ({
  useFocusArea: () => mockUseFocusArea(),
}))

// Mock useSidebar — typed explicitly for the full sidebar context shape
const mockCloseMobile = vi.fn()
const mockUseSidebar = vi.fn<() => SidebarReturn>(() => ({
  collapsed: false,
  toggleSidebar: vi.fn(),
  mobileOpen: false,
  toggleMobile: vi.fn(),
  closeMobile: mockCloseMobile,
}))

vi.mock('@/components/providers/SidebarProvider', () => ({
  useSidebar: () => mockUseSidebar(),
}))

// Mock Radix Collapsible — simple pass-through that forwards the `open` prop
// as a data attribute so tests can inspect collapse state easily.
vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => (
    <div
      data-testid="collapsible"
      data-open={open ? 'true' : 'false'}
      onClick={() => onOpenChange(!open)}
    >
      {children}
    </div>
  ),
  CollapsibleTrigger: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode
    className?: string
    onClick?: () => void
  }) => (
    <button data-testid="collapsible-trigger" className={className} onClick={onClick}>
      {children}
    </button>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
}))

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
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

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_FOCUS_AREAS: FocusArea[] = [
  { id: 1, name: 'AI & ML', color: '#6366f1', createdAt: new Date('2024-01-01') },
  { id: 2, name: 'Web Dev', color: '#22c55e', createdAt: new Date('2024-01-02') },
  { id: 3, name: 'DevOps', color: null, createdAt: new Date('2024-01-03') },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SidebarFocusAreas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()

    // Default: expanded sidebar, no focus areas, not loading
    mockUseSidebar.mockReturnValue({
      collapsed: false,
      toggleSidebar: vi.fn(),
      mobileOpen: false,
      toggleMobile: vi.fn(),
      closeMobile: mockCloseMobile,
    })
    mockUseFocusArea.mockReturnValue({
      focusAreas: [],
      selectedFocusAreaId: null,
      setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
      refetch: vi.fn(),
      isLoading: false,
    })
  })

  // -------------------------------------------------------------------------
  // Visibility / null-return conditions
  // -------------------------------------------------------------------------

  describe('null-return conditions', () => {
    it('returns null when sidebar is collapsed', () => {
      mockUseSidebar.mockReturnValue({
        collapsed: true,
        toggleSidebar: vi.fn(),
        mobileOpen: false,
        toggleMobile: vi.fn(),
        closeMobile: mockCloseMobile,
      })
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: null,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: false,
      })

      const { container } = render(<SidebarFocusAreas />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null when not loading and there are no focus areas', () => {
      mockUseFocusArea.mockReturnValue({
        focusAreas: [],
        selectedFocusAreaId: null,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: false,
      })

      const { container } = render(<SidebarFocusAreas />)
      expect(container.firstChild).toBeNull()
    })

    it('renders loading skeleton while loading even if focusAreas array is empty', () => {
      mockUseFocusArea.mockReturnValue({
        focusAreas: [],
        selectedFocusAreaId: null,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: true,
      })

      render(<SidebarFocusAreas />)
      const pulseDivs = document.querySelectorAll('.animate-pulse')
      expect(pulseDivs.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('renders 2 skeleton rows while isLoading=true', () => {
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: null,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: true,
      })

      render(<SidebarFocusAreas />)
      const pulseDivs = document.querySelectorAll('.animate-pulse')
      // 2 pulse elements per skeleton row × 2 rows = 4
      expect(pulseDivs.length).toBe(4)
    })

    it('does not render focus area buttons while loading', () => {
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: null,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: true,
      })

      render(<SidebarFocusAreas />)
      expect(screen.queryByText('AI & ML')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Focus area rendering
  // -------------------------------------------------------------------------

  describe('focus area list rendering', () => {
    beforeEach(() => {
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: null,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: false,
      })
    })

    it('renders all focus area names', () => {
      render(<SidebarFocusAreas />)
      expect(screen.getByText('AI & ML')).toBeInTheDocument()
      expect(screen.getByText('Web Dev')).toBeInTheDocument()
      expect(screen.getByText('DevOps')).toBeInTheDocument()
    })

    it('renders the section header with "Focus Areas" label', () => {
      render(<SidebarFocusAreas />)
      expect(screen.getByText('Focus Areas')).toBeInTheDocument()
    })

    it('renders a button for each focus area', () => {
      render(<SidebarFocusAreas />)
      const focusAreaButtons = screen.getAllByRole('button').filter(
        (btn) =>
          btn.textContent?.includes('AI & ML') ||
          btn.textContent?.includes('Web Dev') ||
          btn.textContent?.includes('DevOps'),
      )
      expect(focusAreaButtons).toHaveLength(3)
    })

    it('renders a color dot for each focus area', () => {
      render(<SidebarFocusAreas />)
      // Target the dot spans specifically: rounded-full + shrink-0 + aria-hidden, inside buttons
      const dots = document.querySelectorAll('button span[aria-hidden="true"]')
      expect(dots.length).toBe(3)
    })

    it('renders color dot with correct backgroundColor style for colored focus area', () => {
      render(<SidebarFocusAreas />)
      const aiMlButton = screen.getByText('AI & ML').closest('button')!
      const dot = aiMlButton.querySelector('[aria-hidden="true"]') as HTMLElement
      expect(dot.style.backgroundColor).toBe('rgb(99, 102, 241)')
    })

    it('renders color dot with fallback var(--muted-foreground) when color is null', () => {
      render(<SidebarFocusAreas />)
      const devOpsButton = screen.getByText('DevOps').closest('button')!
      const dot = devOpsButton.querySelector('[aria-hidden="true"]') as HTMLElement
      expect(dot.style.backgroundColor).toBe('var(--muted-foreground)')
    })
  })

  // -------------------------------------------------------------------------
  // Click / filter behavior
  // -------------------------------------------------------------------------

  describe('filter behavior', () => {
    beforeEach(() => {
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: null,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: false,
      })
    })

    it('calls setSelectedFocusAreaId with the focus area id when clicked', async () => {
      const user = userEvent.setup()
      render(<SidebarFocusAreas />)

      await user.click(screen.getByText('AI & ML'))
      expect(mockSetSelectedFocusAreaId).toHaveBeenCalledWith(1)
    })

    it('navigates to / when a focus area is clicked', async () => {
      const user = userEvent.setup()
      render(<SidebarFocusAreas />)

      await user.click(screen.getByText('AI & ML'))
      expect(mockRouterPush).toHaveBeenCalledWith('/')
    })

    it('calls setSelectedFocusAreaId(null) when clicking the active focus area (toggle off)', async () => {
      const user = userEvent.setup()
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: 1,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: false,
      })

      render(<SidebarFocusAreas />)
      await user.click(screen.getByText('AI & ML'))
      expect(mockSetSelectedFocusAreaId).toHaveBeenCalledWith(null)
    })

    it('still navigates to / when clicking the active focus area to clear it', async () => {
      const user = userEvent.setup()
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: 1,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: false,
      })

      render(<SidebarFocusAreas />)
      await user.click(screen.getByText('AI & ML'))
      expect(mockRouterPush).toHaveBeenCalledWith('/')
    })

    it('calls closeMobile() on focus area click', async () => {
      const user = userEvent.setup()
      render(<SidebarFocusAreas />)

      await user.click(screen.getByText('AI & ML'))
      expect(mockCloseMobile).toHaveBeenCalledOnce()
    })
  })

  // -------------------------------------------------------------------------
  // Active state
  // -------------------------------------------------------------------------

  describe('active focus area highlight', () => {
    beforeEach(() => {
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: 1,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: false,
      })
    })

    it('applies active styles to the currently active focus area', () => {
      render(<SidebarFocusAreas />)
      const aiMlButton = screen.getByText('AI & ML').closest('button')!
      expect(aiMlButton.className).toContain('bg-primary/10')
      expect(aiMlButton.className).toContain('text-primary')
      expect(aiMlButton.className).toContain('font-medium')
    })

    it('does not apply active styles to inactive focus areas', () => {
      render(<SidebarFocusAreas />)
      const webDevButton = screen.getByText('Web Dev').closest('button')!
      expect(webDevButton.className).not.toContain('bg-primary/10')
      expect(webDevButton.className).not.toContain('text-primary')
    })

    it('applies inactive styles to non-active focus areas', () => {
      render(<SidebarFocusAreas />)
      const webDevButton = screen.getByText('Web Dev').closest('button')!
      expect(webDevButton.className).toContain('text-muted-foreground')
    })

    it('no focus area is highlighted when selectedFocusAreaId is null', () => {
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: null,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: false,
      })

      render(<SidebarFocusAreas />)
      const aiMlButton = screen.getByText('AI & ML').closest('button')!
      expect(aiMlButton.className).not.toContain('bg-primary/10')
    })
  })

  // -------------------------------------------------------------------------
  // Collapsible behavior and localStorage persistence
  // -------------------------------------------------------------------------

  describe('collapsible behavior', () => {
    beforeEach(() => {
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: null,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: false,
      })
    })

    it('defaults to open (isOpen=true) when no localStorage value', () => {
      render(<SidebarFocusAreas />)
      const collapsible = screen.getByTestId('collapsible')
      expect(collapsible.getAttribute('data-open')).toBe('true')
    })

    it('initializes as closed when localStorage has "false"', async () => {
      localStorageMock.setItem('sluice-sidebar-focus-areas-open', 'false')

      render(<SidebarFocusAreas />)
      // useEffect runs after mount, so we wait for the state update
      await waitFor(() => {
        const collapsible = screen.getByTestId('collapsible')
        expect(collapsible.getAttribute('data-open')).toBe('false')
      })
    })

    it('persists open state to localStorage when toggled', async () => {
      const user = userEvent.setup()
      render(<SidebarFocusAreas />)

      // Click the collapsible container to toggle (our mock calls onOpenChange)
      const collapsible = screen.getByTestId('collapsible')
      await user.click(collapsible)

      expect(localStorageMock.getItem('sluice-sidebar-focus-areas-open')).toBe('false')
    })

    it('persists re-opened state to localStorage', async () => {
      localStorageMock.setItem('sluice-sidebar-focus-areas-open', 'false')
      const user = userEvent.setup()

      render(<SidebarFocusAreas />)

      await waitFor(() => {
        const collapsible = screen.getByTestId('collapsible')
        expect(collapsible.getAttribute('data-open')).toBe('false')
      })

      const collapsible = screen.getByTestId('collapsible')
      await user.click(collapsible)

      expect(localStorageMock.getItem('sluice-sidebar-focus-areas-open')).toBe('true')
    })
  })

  // -------------------------------------------------------------------------
  // localStorage error handling
  // -------------------------------------------------------------------------

  describe('localStorage error handling', () => {
    beforeEach(() => {
      mockUseFocusArea.mockReturnValue({
        focusAreas: MOCK_FOCUS_AREAS,
        selectedFocusAreaId: null,
        setSelectedFocusAreaId: mockSetSelectedFocusAreaId,
        refetch: vi.fn(),
        isLoading: false,
      })
    })

    it('renders without crashing when localStorage.getItem throws', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      expect(() => render(<SidebarFocusAreas />)).not.toThrow()

      getItemSpy.mockRestore()
    })

    it('renders without crashing when localStorage.setItem throws', async () => {
      const user = userEvent.setup()
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      render(<SidebarFocusAreas />)
      const collapsible = screen.getByTestId('collapsible')

      // Should not throw
      await expect(user.click(collapsible)).resolves.not.toThrow()

      setItemSpy.mockRestore()
    })
  })
})
