import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SidebarNav } from '../SidebarNav'
import { TooltipProvider } from '@/components/ui/tooltip'

// Mock Next.js navigation
const mockUsePathname = vi.fn(() => '/')
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, className, ...props }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className} {...props}>{children}</a>
  ),
}))

// Mock useSidebar hook
const mockUseSidebar = vi.fn(() => ({ collapsed: false, toggleSidebar: vi.fn(), closeMobile: vi.fn() }))
vi.mock('@/components/providers/SidebarProvider', () => ({
  useSidebar: () => mockUseSidebar(),
}))

describe('SidebarNav', () => {
  beforeEach(() => {
    mockUseSidebar.mockReturnValue({ collapsed: false, toggleSidebar: vi.fn(), closeMobile: vi.fn() })
    mockUsePathname.mockReturnValue('/')
  })

  const renderNav = () => {
    return render(
      <TooltipProvider>
        <SidebarNav />
      </TooltipProvider>
    )
  }

  describe('expanded state', () => {
    it('renders all navigation items', () => {
      renderNav()

      expect(screen.getByText('Knowledge Bank')).toBeInTheDocument()
      expect(screen.getByText('Add Video')).toBeInTheDocument()
      expect(screen.getByText('Add Transcript')).toBeInTheDocument()
      expect(screen.getByText('Discovery')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('renders Add Transcript link with correct href', () => {
      renderNav()

      const addTranscriptLink = screen.getByRole('link', { name: /Add Transcript/i })
      expect(addTranscriptLink).toBeInTheDocument()
      expect(addTranscriptLink).toHaveAttribute('href', '/add-transcript')
    })

    it('renders navigation items in correct order', () => {
      renderNav()

      const links = screen.getAllByRole('link')
      expect(links[0]).toHaveTextContent('Knowledge Bank')
      expect(links[1]).toHaveTextContent('Add Video')
      expect(links[2]).toHaveTextContent('Add Transcript')
      expect(links[3]).toHaveTextContent('Discovery')
      expect(links[4]).toHaveTextContent('Settings')
    })

    it('shows labels for all navigation items', () => {
      renderNav()

      expect(screen.getByText('Knowledge Bank')).toBeVisible()
      expect(screen.getByText('Add Video')).toBeVisible()
      expect(screen.getByText('Add Transcript')).toBeVisible()
      expect(screen.getByText('Discovery')).toBeVisible()
      expect(screen.getByText('Settings')).toBeVisible()
    })
  })

  describe('collapsed state', () => {
    beforeEach(() => {
      mockUseSidebar.mockReturnValue({ collapsed: true, toggleSidebar: vi.fn(), closeMobile: vi.fn() })
    })

    it('hides labels when collapsed', () => {
      renderNav()

      expect(screen.queryByText('Knowledge Bank')).not.toBeInTheDocument()
      expect(screen.queryByText('Add Video')).not.toBeInTheDocument()
      expect(screen.queryByText('Add Transcript')).not.toBeInTheDocument()
      expect(screen.queryByText('Discovery')).not.toBeInTheDocument()
      expect(screen.queryByText('Settings')).not.toBeInTheDocument()
    })

    it('still renders all navigation links', () => {
      renderNav()

      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(5)
      expect(links[0]).toHaveAttribute('href', '/')
      expect(links[1]).toHaveAttribute('href', '/add')
      expect(links[2]).toHaveAttribute('href', '/add-transcript')
      expect(links[3]).toHaveAttribute('href', '/discovery')
      expect(links[4]).toHaveAttribute('href', '/settings')
    })

    it('applies centered layout classes when collapsed', () => {
      const { container } = renderNav()

      const links = container.querySelectorAll('a')
      // First link (Knowledge Bank)
      expect(links[0]).toHaveClass('justify-center')
      expect(links[0]).toHaveClass('px-0')
      expect(links[0]).toHaveClass('py-2')
    })

    it('highlights active route when collapsed', () => {
      mockUsePathname.mockReturnValue('/add')
      const { container } = renderNav()

      const links = container.querySelectorAll('a')
      const activeLink = links[1] // /add is second link
      expect(activeLink).toHaveClass('bg-primary')
      expect(activeLink).toHaveClass('text-primary-foreground')
    })
  })

  describe('mobile sidebar behavior', () => {
    it('calls closeMobile when nav link is clicked', () => {
      const mockCloseMobile = vi.fn()
      mockUseSidebar.mockReturnValue({
        collapsed: false,
        toggleSidebar: vi.fn(),
        closeMobile: mockCloseMobile
      })

      renderNav()

      const knowledgeBankLink = screen.getByRole('link', { name: /Knowledge Bank/i })
      knowledgeBankLink.click()

      expect(mockCloseMobile).toHaveBeenCalledOnce()
    })

    it('calls closeMobile when collapsed nav link is clicked', () => {
      const mockCloseMobile = vi.fn()
      mockUseSidebar.mockReturnValue({
        collapsed: true,
        toggleSidebar: vi.fn(),
        closeMobile: mockCloseMobile
      })

      renderNav()

      const links = screen.getAllByRole('link')
      links[0]!.click() // Click first link (Knowledge Bank)

      expect(mockCloseMobile).toHaveBeenCalledOnce()
    })
  })
})
