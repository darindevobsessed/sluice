import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { MainContent } from '../MainContent'
import { SidebarProvider } from '@/components/providers/SidebarProvider'
import { FocusAreaProvider } from '@/components/providers/FocusAreaProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '../Sidebar'

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

// Mock fetch for FocusAreaProvider
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ focusAreas: [] }),
  } as Response)
)

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <FocusAreaProvider>
        <TooltipProvider>
          <Sidebar />
          <MainContent>{children}</MainContent>
        </TooltipProvider>
      </FocusAreaProvider>
    </SidebarProvider>
  )
}

describe('MainContent', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('dynamic margin coordination', () => {
    it('renders with 240px left margin when sidebar is expanded', () => {
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      const mainContent = screen.getByTestId('content').parentElement?.parentElement
      expect(mainContent).toBeTruthy()

      // Should have ml-60 class (240px) or inline style
      expect(
        mainContent?.classList.contains('ml-60') ||
        mainContent?.style.marginLeft === '240px'
      ).toBe(true)
    })

    it('renders with 64px left margin when sidebar is collapsed', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      // Collapse the sidebar
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
      await user.click(toggleButton)

      const mainContent = screen.getByTestId('content').parentElement?.parentElement
      expect(mainContent).toBeTruthy()

      // Should have ml-16 class (64px) or inline style
      expect(
        mainContent?.classList.contains('ml-16') ||
        mainContent?.style.marginLeft === '64px'
      ).toBe(true)
    })

    it('toggles margin in sync with sidebar width', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <div data-testid="content">Test Content</div>
        </TestWrapper>
      )

      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
      const mainContent = screen.getByTestId('content').parentElement?.parentElement
      const sidebar = screen.getByRole('complementary')

      // Start expanded - both should be in expanded state
      expect(
        mainContent?.classList.contains('ml-60') ||
        mainContent?.style.marginLeft === '240px'
      ).toBe(true)
      expect(sidebar.style.width).toBe('240px')

      // Click to collapse - both should be in collapsed state
      await user.click(toggleButton)
      expect(
        mainContent?.classList.contains('ml-16') ||
        mainContent?.style.marginLeft === '64px'
      ).toBe(true)
      expect(sidebar.style.width).toBe('64px')

      // Click to expand again - both should be in expanded state
      await user.click(toggleButton)
      expect(
        mainContent?.classList.contains('ml-60') ||
        mainContent?.style.marginLeft === '240px'
      ).toBe(true)
      expect(sidebar.style.width).toBe('240px')
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
      const sidebar = screen.getByRole('complementary')

      // Both should have their respective container classes with matching transitions
      expect(sidebar.classList.contains('sidebar-container')).toBe(true)
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

      // Toggle sidebar
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
      await user.click(toggleButton)

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

      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
      const mainContent = screen.getByTestId('content').parentElement?.parentElement
      const sidebar = screen.getByRole('complementary')

      // Rapid toggle 3 times
      await user.click(toggleButton) // collapse
      await user.click(toggleButton) // expand
      await user.click(toggleButton) // collapse

      // After 3 clicks (odd number), should be in collapsed state
      expect(
        mainContent?.classList.contains('ml-16') ||
        mainContent?.style.marginLeft === '64px'
      ).toBe(true)
      expect(sidebar.style.width).toBe('64px')

      // One more click to expand
      await user.click(toggleButton)
      expect(
        mainContent?.classList.contains('ml-60') ||
        mainContent?.style.marginLeft === '240px'
      ).toBe(true)
      expect(sidebar.style.width).toBe('240px')
    })
  })
})
