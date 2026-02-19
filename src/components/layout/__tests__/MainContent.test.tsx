import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { MainContent } from '../MainContent'
import { SidebarProvider } from '@/components/providers/SidebarProvider'
import { SidebarDataProvider } from '@/components/providers/SidebarDataProvider'
import { FocusAreaProvider } from '@/components/providers/FocusAreaProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '../Sidebar'

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

// Mock fetch for SidebarDataProvider and FocusAreaProvider
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ channels: [], focusAreas: [] }),
  } as Response)
)

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <SidebarDataProvider>
        <FocusAreaProvider>
          <TooltipProvider>
            <Sidebar />
            <MainContent>{children}</MainContent>
          </TooltipProvider>
        </FocusAreaProvider>
      </SidebarDataProvider>
    </SidebarProvider>
  )
}

describe('MainContent', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('dynamic margin coordination', () => {
    it('renders with responsive margin classes (no margin on mobile, margin on desktop)', () => {
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      const mainContent = screen.getByTestId('content').parentElement?.parentElement
      expect(mainContent).toBeTruthy()

      // Should have responsive classes: md:ml-60 (240px on desktop)
      expect(mainContent?.classList.contains('md:ml-60')).toBe(true)
    })

    it('renders with responsive collapsed margin when sidebar is collapsed', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      // Collapse the sidebar (use first toggle button - desktop)
      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      await user.click(toggleButtons[0]!)

      const mainContent = screen.getByTestId('content').parentElement?.parentElement
      expect(mainContent).toBeTruthy()

      // Should have responsive classes: md:ml-16 (64px on desktop)
      expect(mainContent?.classList.contains('md:ml-16')).toBe(true)
    })

    it('toggles margin in sync with sidebar width', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      const desktopToggleButton = toggleButtons[0]!
      const mainContent = screen.getByTestId('content').parentElement?.parentElement
      const sidebars = screen.getAllByRole('complementary')
      const desktopSidebar = sidebars[0]!

      // Start expanded - both should be in expanded state
      expect(mainContent?.classList.contains('md:ml-60')).toBe(true)
      expect(desktopSidebar.style.width).toBe('240px')

      // Click to collapse - both should be in collapsed state
      await user.click(desktopToggleButton)
      expect(mainContent?.classList.contains('md:ml-16')).toBe(true)
      expect(desktopSidebar.style.width).toBe('64px')

      // Click to expand again - both should be in expanded state
      await user.click(desktopToggleButton)
      expect(mainContent?.classList.contains('md:ml-60')).toBe(true)
      expect(desktopSidebar.style.width).toBe('240px')
    })
  })

  describe('transition timing', () => {
    it('applies main-content-container class for CSS transition', () => {
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      const mainContent = screen.getByTestId('content').parentElement?.parentElement
      expect(mainContent).toBeTruthy()

      // Should have the main-content-container class which has CSS transition
      expect(mainContent?.classList.contains('main-content-container')).toBe(true)
    })

    it('uses same transition timing as sidebar', () => {
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      const mainContent = screen.getByTestId('content').parentElement?.parentElement
      const sidebars = screen.getAllByRole('complementary')
      const desktopSidebar = sidebars[0]!

      // Both should have their respective container classes with matching transitions
      expect(desktopSidebar.classList.contains('sidebar-container')).toBe(true)
      expect(mainContent?.classList.contains('main-content-container')).toBe(true)
    })
  })

  describe('content behavior', () => {
    it('renders children content correctly', () => {
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
      expect(screen.getByTestId('content')).toHaveTextContent('Test Content')
    })

    it('maintains content visibility during margin transition', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      const content = screen.getByTestId('content')
      expect(content).toBeVisible()

      // Toggle sidebar (use first toggle button - desktop)
      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      await user.click(toggleButtons[0]!)

      // Content should still be visible
      expect(content).toBeVisible()
      expect(content).toHaveTextContent('Test Content')
    })
  })

  describe('rapid toggling', () => {
    it('handles rapid sidebar toggles without desync', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      const toggleButtons = screen.getAllByRole('button', { name: /toggle sidebar/i })
      const desktopToggleButton = toggleButtons[0]!
      const mainContent = screen.getByTestId('content').parentElement?.parentElement
      const sidebars = screen.getAllByRole('complementary')
      const desktopSidebar = sidebars[0]!

      // Rapid toggle 3 times
      await user.click(desktopToggleButton) // collapse
      await user.click(desktopToggleButton) // expand
      await user.click(desktopToggleButton) // collapse

      // After 3 clicks (odd number), should be in collapsed state
      expect(mainContent?.classList.contains('md:ml-16')).toBe(true)
      expect(desktopSidebar.style.width).toBe('64px')

      // One more click to expand
      await user.click(desktopToggleButton)
      expect(mainContent?.classList.contains('md:ml-60')).toBe(true)
      expect(desktopSidebar.style.width).toBe('240px')
    })
  })
})
