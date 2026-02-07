import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopBar } from '../TopBar'
import { PageTitleProvider } from '../PageTitleContext'

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('TopBar', () => {
  it('renders with 56px height and correct styling', () => {
    const { container } = render(
      <PageTitleProvider>
        <TopBar />
      </PageTitleProvider>
    )

    const topBar = container.firstChild as HTMLElement
    expect(topBar).toBeInTheDocument()
    expect(topBar.tagName).toBe('HEADER')
    expect(topBar).toHaveClass('h-14', 'bg-card', 'border-b')
  })

  it('displays page title when set', () => {
    function TestPage() {
      return (
        <PageTitleProvider>
          <TopBar title="Knowledge Bank" />
        </PageTitleProvider>
      )
    }

    render(<TestPage />)
    expect(screen.getByText('Knowledge Bank')).toBeInTheDocument()
  })

  it('renders without title when not provided', () => {
    const { container } = render(
      <PageTitleProvider>
        <TopBar />
      </PageTitleProvider>
    )

    const titleElement = container.querySelector('[data-testid="page-title"]')
    expect(titleElement).toBeInTheDocument()
    expect(titleElement?.textContent).toBe('')
  })

  it('displays back button when backHref is provided', () => {
    render(
      <PageTitleProvider>
        <TopBar title="Video Detail" backHref="/" backLabel="Knowledge Bank" />
      </PageTitleProvider>
    )

    const backLink = screen.getByRole('link', { name: /Knowledge Bank/i })
    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveAttribute('href', '/')
  })

  it('does not display back button when backHref is not provided', () => {
    render(
      <PageTitleProvider>
        <TopBar title="Knowledge Bank" />
      </PageTitleProvider>
    )

    const backButton = screen.queryByRole('link')
    expect(backButton).not.toBeInTheDocument()
  })

  it('renders right slot content when provided', () => {
    render(
      <PageTitleProvider>
        <TopBar title="Knowledge Bank">
          <div data-testid="custom-right-content">Custom Content</div>
        </TopBar>
      </PageTitleProvider>
    )

    expect(screen.getByTestId('custom-right-content')).toBeInTheDocument()
    expect(screen.getByText('Custom Content')).toBeInTheDocument()
  })

  it('has proper flex layout with justify-between', () => {
    const { container } = render(
      <PageTitleProvider>
        <TopBar title="Test" />
      </PageTitleProvider>
    )

    const topBar = container.firstChild as HTMLElement
    expect(topBar).toHaveClass('flex', 'justify-between', 'items-center')
  })

  it('applies px-6 spacing', () => {
    const { container } = render(
      <PageTitleProvider>
        <TopBar title="Test" />
      </PageTitleProvider>
    )

    const topBar = container.firstChild as HTMLElement
    expect(topBar).toHaveClass('px-6')
  })

  it('applies transition to title for crossfade animation', () => {
    render(
      <PageTitleProvider>
        <TopBar title="Test Title" />
      </PageTitleProvider>
    )

    const titleElement = screen.getByText('Test Title')
    expect(titleElement).toHaveClass('transition-opacity', 'duration-200')
  })
})
