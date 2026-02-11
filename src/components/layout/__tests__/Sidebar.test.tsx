import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { Sidebar } from '../Sidebar'
import { SidebarProvider } from '@/components/providers/SidebarProvider'
import { TooltipProvider } from '@/components/ui/tooltip'

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

function SidebarTestWrapper() {
  return (
    <SidebarProvider>
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>
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
      const sidebar = screen.getByRole('complementary')

      // Should have expanded width class or inline style
      expect(
        sidebar.classList.contains('w-60') ||
        sidebar.style.width === '240px'
      ).toBe(true)
    })

    it('shows logo text when expanded', () => {
      render(<SidebarTestWrapper />)
      expect(screen.getByText('Gold Miner')).toBeInTheDocument()
    })

    it('shows left-pointing chevron when expanded', () => {
      render(<SidebarTestWrapper />)
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })

      // ChevronLeft should be present (svg will have data-lucide="chevron-left")
      const svg = toggleButton.querySelector('svg')
      expect(svg?.getAttribute('data-lucide')).toBe('chevron-left')
    })
  })

  describe('collapsed state', () => {
    it('collapses to 64px width when toggle button is clicked', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
      await user.click(toggleButton)

      const sidebar = screen.getByRole('complementary')
      expect(
        sidebar.classList.contains('w-16') ||
        sidebar.style.width === '64px'
      ).toBe(true)
    })

    it('hides logo text when collapsed', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
      await user.click(toggleButton)

      // Text should not be visible (either removed from DOM or hidden)
      const logoText = screen.queryByText('Gold Miner')
      expect(
        logoText === null ||
        logoText.classList.contains('hidden') ||
        logoText.classList.contains('opacity-0')
      ).toBe(true)
    })

    it('shows right-pointing chevron when collapsed', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
      await user.click(toggleButton)

      const svg = toggleButton.querySelector('svg')
      expect(svg?.getAttribute('data-lucide')).toBe('chevron-right')
    })
  })

  describe('toggle interaction', () => {
    it('toggles between expanded and collapsed on button click', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })

      // Start expanded
      expect(screen.getByText('Gold Miner')).toBeInTheDocument()

      // Click to collapse
      await user.click(toggleButton)
      const logoTextAfterCollapse = screen.queryByText('Gold Miner')
      expect(
        logoTextAfterCollapse === null ||
        logoTextAfterCollapse.classList.contains('hidden') ||
        logoTextAfterCollapse.classList.contains('opacity-0')
      ).toBe(true)

      // Click to expand again
      await user.click(toggleButton)
      expect(screen.getByText('Gold Miner')).toBeInTheDocument()
    })

    it('persists collapsed state to localStorage', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
      await user.click(toggleButton)

      expect(localStorageMock.getItem('gold-miner-sidebar-collapsed')).toBe('true')
    })
  })

  describe('CSS transition', () => {
    it('applies transition classes for smooth animation', () => {
      render(<SidebarTestWrapper />)
      const sidebar = screen.getByRole('complementary')

      // Should have the sidebar-container class which has CSS transition
      expect(sidebar.classList.contains('sidebar-container')).toBe(true)
    })

    it('applies overflow-hidden to clip content during transition', () => {
      render(<SidebarTestWrapper />)
      const sidebar = screen.getByRole('complementary')

      expect(
        sidebar.classList.contains('overflow-hidden') ||
        sidebar.style.overflow === 'hidden'
      ).toBe(true)
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA role for sidebar', () => {
      render(<SidebarTestWrapper />)
      expect(screen.getByRole('complementary')).toBeInTheDocument()
    })

    it('toggle button is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<SidebarTestWrapper />)

      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
      toggleButton.focus()

      expect(toggleButton).toHaveFocus()

      // Should toggle on Enter
      await user.keyboard('{Enter}')
      const sidebar = screen.getByRole('complementary')
      expect(
        sidebar.classList.contains('w-16') ||
        sidebar.style.width === '64px'
      ).toBe(true)
    })
  })
})
