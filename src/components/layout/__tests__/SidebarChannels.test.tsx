import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { SidebarChannels } from '../SidebarChannels'
import type { SidebarChannel } from '@/components/providers/SidebarDataProvider'

// ---------------------------------------------------------------------------
// Type helpers for mock return values
// ---------------------------------------------------------------------------

interface SidebarDataReturn {
  channels: SidebarChannel[]
  isLoading: boolean
  refetch: () => Promise<void>
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
const mockSearchParamsGet = vi.fn<(key: string) => string | null>(() => null)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}))

// Mock useSidebarData — typed explicitly to avoid inferred `never[]` for channels
const mockUseSidebarData = vi.fn<() => SidebarDataReturn>(() => ({
  channels: [],
  isLoading: false,
  refetch: vi.fn(),
}))

vi.mock('@/components/providers/SidebarDataProvider', () => ({
  useSidebarData: () => mockUseSidebarData(),
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

const MOCK_CHANNELS: SidebarChannel[] = [
  { name: 'Fireship', videoCount: 12 },
  { name: 'Theo', videoCount: 8 },
  { name: 'Syntax.fm', videoCount: 3 },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SidebarChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()

    // Default: expanded sidebar, no channels, not loading
    mockUseSidebar.mockReturnValue({
      collapsed: false,
      toggleSidebar: vi.fn(),
      mobileOpen: false,
      toggleMobile: vi.fn(),
      closeMobile: mockCloseMobile,
    })
    mockUseSidebarData.mockReturnValue({
      channels: [],
      isLoading: false,
      refetch: vi.fn(),
    })
    mockSearchParamsGet.mockReturnValue(null)
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
      mockUseSidebarData.mockReturnValue({
        channels: MOCK_CHANNELS,
        isLoading: false,
        refetch: vi.fn(),
      })

      const { container } = render(<SidebarChannels />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null when not loading and there are no channels', () => {
      mockUseSidebarData.mockReturnValue({
        channels: [],
        isLoading: false,
        refetch: vi.fn(),
      })

      const { container } = render(<SidebarChannels />)
      expect(container.firstChild).toBeNull()
    })

    it('renders loading skeleton while loading even if channels array is empty', () => {
      mockUseSidebarData.mockReturnValue({
        channels: [],
        isLoading: true,
        refetch: vi.fn(),
      })

      render(<SidebarChannels />)
      const pulseDivs = document.querySelectorAll('.animate-pulse')
      expect(pulseDivs.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('renders 3 skeleton rows while isLoading=true', () => {
      mockUseSidebarData.mockReturnValue({
        channels: MOCK_CHANNELS,
        isLoading: true,
        refetch: vi.fn(),
      })

      render(<SidebarChannels />)
      const pulseDivs = document.querySelectorAll('.animate-pulse')
      // 2 pulse elements per skeleton row × 3 rows = 6
      expect(pulseDivs.length).toBe(6)
    })

    it('does not render channel buttons while loading', () => {
      mockUseSidebarData.mockReturnValue({
        channels: MOCK_CHANNELS,
        isLoading: true,
        refetch: vi.fn(),
      })

      render(<SidebarChannels />)
      expect(screen.queryByText('Fireship')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Channel rendering
  // -------------------------------------------------------------------------

  describe('channel list rendering', () => {
    beforeEach(() => {
      mockUseSidebarData.mockReturnValue({
        channels: MOCK_CHANNELS,
        isLoading: false,
        refetch: vi.fn(),
      })
    })

    it('renders all channel names', () => {
      render(<SidebarChannels />)
      expect(screen.getByText('Fireship')).toBeInTheDocument()
      expect(screen.getByText('Theo')).toBeInTheDocument()
      expect(screen.getByText('Syntax.fm')).toBeInTheDocument()
    })

    it('renders video count badges for each channel', () => {
      render(<SidebarChannels />)
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('renders the section header with "Channels" label', () => {
      render(<SidebarChannels />)
      expect(screen.getByText('Channels')).toBeInTheDocument()
    })

    it('renders a button for each channel', () => {
      render(<SidebarChannels />)
      const channelButtons = screen.getAllByRole('button').filter(
        (btn) =>
          btn.textContent?.includes('Fireship') ||
          btn.textContent?.includes('Theo') ||
          btn.textContent?.includes('Syntax.fm'),
      )
      expect(channelButtons).toHaveLength(3)
    })
  })

  // -------------------------------------------------------------------------
  // Navigation behavior
  // -------------------------------------------------------------------------

  describe('navigation behavior', () => {
    beforeEach(() => {
      mockUseSidebarData.mockReturnValue({
        channels: MOCK_CHANNELS,
        isLoading: false,
        refetch: vi.fn(),
      })
    })

    it('navigates to /?channel=ChannelName when a channel is clicked', async () => {
      const user = userEvent.setup()
      render(<SidebarChannels />)

      await user.click(screen.getByText('Fireship'))
      expect(mockRouterPush).toHaveBeenCalledWith('/?channel=Fireship')
    })

    it('URL-encodes the channel name when navigating', async () => {
      const user = userEvent.setup()
      mockUseSidebarData.mockReturnValue({
        channels: [{ name: 'The Primeagen & Friends', videoCount: 5 }],
        isLoading: false,
        refetch: vi.fn(),
      })

      render(<SidebarChannels />)
      await user.click(screen.getByText('The Primeagen & Friends'))
      expect(mockRouterPush).toHaveBeenCalledWith(
        `/?channel=${encodeURIComponent('The Primeagen & Friends')}`,
      )
    })

    it('navigates to / when clicking the active channel (clears filter)', async () => {
      const user = userEvent.setup()
      mockSearchParamsGet.mockReturnValue('Fireship')

      render(<SidebarChannels />)
      await user.click(screen.getByText('Fireship'))
      expect(mockRouterPush).toHaveBeenCalledWith('/')
    })

    it('calls closeMobile() on channel click', async () => {
      const user = userEvent.setup()
      render(<SidebarChannels />)

      await user.click(screen.getByText('Fireship'))
      expect(mockCloseMobile).toHaveBeenCalledOnce()
    })
  })

  // -------------------------------------------------------------------------
  // Active state
  // -------------------------------------------------------------------------

  describe('active channel highlight', () => {
    beforeEach(() => {
      mockUseSidebarData.mockReturnValue({
        channels: MOCK_CHANNELS,
        isLoading: false,
        refetch: vi.fn(),
      })
    })

    it('applies active styles to the currently active channel', () => {
      mockSearchParamsGet.mockReturnValue('Fireship')

      render(<SidebarChannels />)
      const fireshipButton = screen.getByText('Fireship').closest('button')!
      expect(fireshipButton.className).toContain('bg-primary/10')
      expect(fireshipButton.className).toContain('text-primary')
      expect(fireshipButton.className).toContain('font-medium')
    })

    it('does not apply active styles to inactive channels', () => {
      mockSearchParamsGet.mockReturnValue('Fireship')

      render(<SidebarChannels />)
      const theoButton = screen.getByText('Theo').closest('button')!
      expect(theoButton.className).not.toContain('bg-primary/10')
      expect(theoButton.className).not.toContain('text-primary')
    })

    it('applies inactive styles to non-active channels', () => {
      mockSearchParamsGet.mockReturnValue('Fireship')

      render(<SidebarChannels />)
      const theoButton = screen.getByText('Theo').closest('button')!
      expect(theoButton.className).toContain('text-muted-foreground')
    })

    it('no channel is highlighted when there is no active channel filter', () => {
      mockSearchParamsGet.mockReturnValue(null)

      render(<SidebarChannels />)
      const fireshipButton = screen.getByText('Fireship').closest('button')!
      expect(fireshipButton.className).not.toContain('bg-primary/10')
    })
  })

  // -------------------------------------------------------------------------
  // Collapsible behavior and localStorage persistence
  // -------------------------------------------------------------------------

  describe('collapsible behavior', () => {
    beforeEach(() => {
      mockUseSidebarData.mockReturnValue({
        channels: MOCK_CHANNELS,
        isLoading: false,
        refetch: vi.fn(),
      })
    })

    it('defaults to open (isOpen=true) when no localStorage value', () => {
      render(<SidebarChannels />)
      const collapsible = screen.getByTestId('collapsible')
      expect(collapsible.getAttribute('data-open')).toBe('true')
    })

    it('initializes as closed when localStorage has "false"', async () => {
      localStorageMock.setItem('gold-miner-sidebar-channels-open', 'false')

      render(<SidebarChannels />)
      // useEffect runs after mount, so we wait for the state update
      await waitFor(() => {
        const collapsible = screen.getByTestId('collapsible')
        expect(collapsible.getAttribute('data-open')).toBe('false')
      })
    })

    it('persists open state to localStorage when toggled', async () => {
      const user = userEvent.setup()
      render(<SidebarChannels />)

      // Click the collapsible container to toggle (our mock calls onOpenChange)
      const collapsible = screen.getByTestId('collapsible')
      await user.click(collapsible)

      expect(localStorageMock.getItem('gold-miner-sidebar-channels-open')).toBe('false')
    })

    it('persists re-opened state to localStorage', async () => {
      localStorageMock.setItem('gold-miner-sidebar-channels-open', 'false')
      const user = userEvent.setup()

      render(<SidebarChannels />)

      await waitFor(() => {
        const collapsible = screen.getByTestId('collapsible')
        expect(collapsible.getAttribute('data-open')).toBe('false')
      })

      const collapsible = screen.getByTestId('collapsible')
      await user.click(collapsible)

      expect(localStorageMock.getItem('gold-miner-sidebar-channels-open')).toBe('true')
    })
  })

  // -------------------------------------------------------------------------
  // localStorage error handling
  // -------------------------------------------------------------------------

  describe('localStorage error handling', () => {
    beforeEach(() => {
      mockUseSidebarData.mockReturnValue({
        channels: MOCK_CHANNELS,
        isLoading: false,
        refetch: vi.fn(),
      })
    })

    it('renders without crashing when localStorage.getItem throws', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      expect(() => render(<SidebarChannels />)).not.toThrow()

      getItemSpy.mockRestore()
    })

    it('renders without crashing when localStorage.setItem throws', async () => {
      const user = userEvent.setup()
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      render(<SidebarChannels />)
      const collapsible = screen.getByTestId('collapsible')

      // Should not throw
      await expect(user.click(collapsible)).resolves.not.toThrow()

      setItemSpy.mockRestore()
    })
  })
})
