import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { Sidebar } from '../Sidebar'
import { SidebarProvider } from '@/components/providers/SidebarProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarDataProvider } from '@/components/providers/SidebarDataProvider'
import { FocusAreaProvider } from '@/components/providers/FocusAreaProvider'

// Mock next/navigation — SidebarChannels and SidebarFocusAreas use useRouter and useSearchParams
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => '/',
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock fetch so SidebarDataProvider and FocusAreaProvider don't make real network calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ channels: [], focusAreas: [] }),
  })
) as unknown as typeof fetch

function SidebarTestWrapper() {
  return (
    <SidebarProvider>
      <SidebarDataProvider>
        <FocusAreaProvider>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </FocusAreaProvider>
      </SidebarDataProvider>
    </SidebarProvider>
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('expanded state (default)', () => {
    it('renders at 240px width when expanded', () => {
      render(<SidebarTestWrapper />)
      const sidebars = screen.getAllByRole('complementary')
      const desktopSidebar = sidebars[0]!

      // Should have expanded width inline style
      expect(desktopSidebar.style.width).toBe('240px')
    })

    it('shows logo text when expanded', () => {
      render(<SidebarTestWrapper />)
      const logoTexts = screen.getAllByText('Sluice')
      expect(logoTexts.length).toBeGreaterThan(0)
      expect(logoTexts[0]).toBeInTheDocument()
    })

    it('shows left-pointing chevron in header when expanded', () => {
      render(<SidebarTestWrapper />)
      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      const desktopToggleButton = toggleButtons[0]!

      // ChevronLeft should be present (svg will have data-lucide="chevron-left")
      const svg = desktopToggleButton.querySelector('svg')
      expect(svg?.getAttribute('data-lucide')).toBe('chevron-left')
    })

    it('toggle button is in the header row', () => {
      render(<SidebarTestWrapper />)
      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      const desktopToggleButton = toggleButtons[0]!
      const logoTexts = screen.getAllByText('Sluice')
      const desktopLogoText = logoTexts[0]!

      // Both should be in the same parent container (the header)
      expect(desktopToggleButton.parentElement).toBe(desktopLogoText.parentElement)
    })
  })

  describe('collapsed state', () => {
    it('collapses to 64px width when toggle button is clicked', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      const desktopToggleButton = toggleButtons[0]!
      await user.click(desktopToggleButton)

      const sidebars = screen.getAllByRole('complementary')
      const desktopSidebar = sidebars[0]!
      expect(desktopSidebar.style.width).toBe('64px')
    })

    it('hides logo text when collapsed', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      const desktopToggleButton = toggleButtons[0]!
      await user.click(desktopToggleButton)

      // Desktop logo text should not be visible (either removed from DOM or hidden)
      // Mobile sidebar still shows text, so we need to check the desktop sidebar specifically
      const sidebars = screen.getAllByRole('complementary')
      const desktopSidebar = sidebars[0]!
      const logoTexts = desktopSidebar.querySelectorAll('span')
      const desktopLogoText = Array.from(logoTexts).find(span => span.textContent === 'Sluice')

      expect(
        desktopLogoText === undefined ||
        desktopLogoText.classList.contains('hidden') ||
        desktopLogoText.classList.contains('opacity-0')
      ).toBe(true)
    })

    it('shows right-pointing chevron when collapsed', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      const desktopToggleButton = toggleButtons[0]!
      await user.click(desktopToggleButton)

      const svg = desktopToggleButton.querySelector('svg')
      expect(svg?.getAttribute('data-lucide')).toBe('chevron-right')
    })
  })

  describe('toggle interaction', () => {
    it('toggles between expanded and collapsed on button click', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      const desktopToggleButton = toggleButtons[0]!
      const sidebars = screen.getAllByRole('complementary')
      const desktopSidebar = sidebars[0]!

      // Start expanded - should be 240px
      expect(desktopSidebar.style.width).toBe('240px')

      // Click to collapse - should be 64px
      await user.click(desktopToggleButton)
      expect(desktopSidebar.style.width).toBe('64px')

      // Click to expand again - should be 240px
      await user.click(desktopToggleButton)
      expect(desktopSidebar.style.width).toBe('240px')
    })

    it('persists collapsed state to localStorage', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      const desktopToggleButton = toggleButtons[0]!
      await user.click(desktopToggleButton)

      expect(localStorageMock.getItem('sluice-sidebar-collapsed')).toBe('true')
    })
  })

  describe('CSS transition', () => {
    it('applies transition classes for smooth animation', () => {
      render(<SidebarTestWrapper />)
      const sidebars = screen.getAllByRole('complementary')
      const desktopSidebar = sidebars[0]!

      // Should have the sidebar-container class which has CSS transition
      expect(desktopSidebar.classList.contains('sidebar-container')).toBe(true)
    })

    it('applies overflow-hidden to clip content during transition', () => {
      render(<SidebarTestWrapper />)
      const sidebars = screen.getAllByRole('complementary')
      const desktopSidebar = sidebars[0]!

      expect(
        desktopSidebar.classList.contains('overflow-hidden') ||
        desktopSidebar.style.overflow === 'hidden'
      ).toBe(true)
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA role for sidebar', () => {
      render(<SidebarTestWrapper />)
      const sidebars = screen.getAllByRole('complementary')
      expect(sidebars.length).toBe(2) // desktop and mobile
      expect(sidebars[0]).toBeInTheDocument()
    })

    it('toggle button is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      const desktopToggleButton = toggleButtons[0]!
      desktopToggleButton.focus()

      expect(desktopToggleButton).toHaveFocus()

      // Should toggle on Enter
      await user.keyboard('{Enter}')
      const sidebars = screen.getAllByRole('complementary')
      const desktopSidebar = sidebars[0]!
      expect(desktopSidebar.style.width).toBe('64px')
    })
  })

  describe('mobile sidebar behavior', () => {
    it('renders mobile sidebar as hidden by default (translate-x-full)', () => {
      render(<SidebarTestWrapper />)
      const mobileSidebar = screen.getAllByRole('complementary')[1]!

      expect(mobileSidebar).toHaveClass('-translate-x-full')
    })

    it('mobile sidebar appears as fixed overlay with z-50', () => {
      render(<SidebarTestWrapper />)
      const mobileSidebar = screen.getAllByRole('complementary')[1]!

      expect(mobileSidebar).toHaveClass('fixed')
      expect(mobileSidebar).toHaveClass('z-50')
    })

    it('mobile sidebar is always 240px width (no collapsed state)', () => {
      render(<SidebarTestWrapper />)
      const mobileSidebar = screen.getAllByRole('complementary')[1]!

      expect(mobileSidebar).toHaveClass('w-60')
    })

    it('desktop sidebar has md:hidden class for mobile', () => {
      render(<SidebarTestWrapper />)
      const desktopSidebar = screen.getAllByRole('complementary')[0]!

      expect(desktopSidebar).toHaveClass('hidden')
      expect(desktopSidebar).toHaveClass('md:flex')
    })

    it('backdrop is not visible when mobile sidebar is closed', () => {
      const { container } = render(<SidebarTestWrapper />)

      // Backdrop should exist but not be visible
      const backdrop = container.querySelector('.bg-black\\/50')
      expect(backdrop).toBeNull()
    })
  })

  describe('section structure', () => {
    it('renders a scrollable content wrapper inside each sidebar', () => {
      const { container } = render(<SidebarTestWrapper />)

      // The overflow-y-auto wrapper should exist inside each sidebar
      const scrollContainers = container.querySelectorAll('.overflow-y-auto')
      expect(scrollContainers.length).toBeGreaterThanOrEqual(2) // one per sidebar
    })

    it('renders a separator between nav and channel sections', () => {
      const { container } = render(<SidebarTestWrapper />)

      // border-t separator divs should be present
      const separators = container.querySelectorAll('.border-t')
      expect(separators.length).toBeGreaterThanOrEqual(2) // one per sidebar
    })
  })
})
