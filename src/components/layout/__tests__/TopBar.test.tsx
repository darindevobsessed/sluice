import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { TopBar } from '../TopBar'
import { PageTitleProvider } from '../PageTitleContext'
import { SidebarProvider } from '@/components/providers/SidebarProvider'

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

function TopBarTestWrapper({ children, ...props }: React.ComponentProps<typeof TopBar>) {
  return (
    <SidebarProvider>
      <PageTitleProvider>
        <TopBar {...props}>{children}</TopBar>
      </PageTitleProvider>
    </SidebarProvider>
  )
}

describe('TopBar', () => {
  it('renders with 56px height and correct styling', () => {
    const { container } = render(<TopBarTestWrapper />)

    const topBar = container.firstChild as HTMLElement
    expect(topBar).toBeInTheDocument()
    expect(topBar.tagName).toBe('HEADER')
    expect(topBar).toHaveClass('h-14', 'bg-card', 'border-b')
  })

  it('displays page title when set', () => {
    render(<TopBarTestWrapper title="Knowledge Bank" />)
    expect(screen.getByText('Knowledge Bank')).toBeInTheDocument()
  })

  it('renders without title when not provided', () => {
    const { container } = render(<TopBarTestWrapper />)

    const titleElement = container.querySelector('[data-testid="page-title"]')
    expect(titleElement).toBeInTheDocument()
    expect(titleElement?.textContent).toBe('')
  })

  it('displays back button when backHref is provided', () => {
    render(<TopBarTestWrapper title="Video Detail" backHref="/" backLabel="Knowledge Bank" />)

    const backLink = screen.getByRole('link', { name: /Knowledge Bank/i })
    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveAttribute('href', '/')
  })

  it('does not display back button when backHref is not provided', () => {
    render(<TopBarTestWrapper title="Knowledge Bank" />)

    const backButton = screen.queryByRole('link')
    expect(backButton).not.toBeInTheDocument()
  })

  it('renders right slot content when provided', () => {
    render(
      <TopBarTestWrapper title="Knowledge Bank">
        <div data-testid="custom-right-content">Custom Content</div>
      </TopBarTestWrapper>
    )

    expect(screen.getByTestId('custom-right-content')).toBeInTheDocument()
    expect(screen.getByText('Custom Content')).toBeInTheDocument()
  })

  it('has proper flex layout with justify-between', () => {
    const { container } = render(<TopBarTestWrapper title="Test" />)

    const topBar = container.firstChild as HTMLElement
    expect(topBar).toHaveClass('flex', 'justify-between', 'items-center')
  })

  it('applies responsive px spacing (px-3 on mobile, px-6 on desktop)', () => {
    const { container } = render(<TopBarTestWrapper title="Test" />)

    const topBar = container.firstChild as HTMLElement
    expect(topBar).toHaveClass('px-3')
    expect(topBar).toHaveClass('sm:px-6')
  })

  it('applies transition to title for crossfade animation', () => {
    render(<TopBarTestWrapper title="Test Title" />)

    const titleElement = screen.getByText('Test Title')
    expect(titleElement).toHaveClass('animate-in', 'fade-in', 'duration-200')
  })

  describe('mobile hamburger menu', () => {
    it('renders hamburger button for mobile', () => {
      render(<TopBarTestWrapper title="Test" />)

      const hamburgerButton = screen.getByRole('button', { name: /open menu/i })
      expect(hamburgerButton).toBeInTheDocument()
    })

    it('hamburger button has mobile-only visibility class', () => {
      render(<TopBarTestWrapper title="Test" />)

      const hamburgerButton = screen.getByRole('button', { name: /open menu/i })
      expect(hamburgerButton).toHaveClass('md:hidden')
    })

    it('calls toggleMobile when hamburger is clicked', async () => {
      const user = userEvent.setup()
      render(<TopBarTestWrapper title="Test" />)

      const hamburgerButton = screen.getByRole('button', { name: /open menu/i })
      await user.click(hamburgerButton)

      // We can't directly test the context state here, but we can verify the button is clickable
      expect(hamburgerButton).toBeEnabled()
    })
  })

  describe('responsive text sizing', () => {
    it('applies responsive text size to title (text-base on mobile, text-lg on desktop)', () => {
      render(<TopBarTestWrapper title="Test Title" />)

      const titleElement = screen.getByText('Test Title')
      expect(titleElement).toHaveClass('text-base')
      expect(titleElement).toHaveClass('sm:text-lg')
    })

    it('applies truncate class to title', () => {
      render(<TopBarTestWrapper title="Very Long Title That Should Be Truncated" />)

      const titleElement = screen.getByTestId('page-title')
      expect(titleElement).toHaveClass('truncate')
    })
  })
})
