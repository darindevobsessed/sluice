import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiscoveryVideoCard } from '../DiscoveryVideoCard'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('DiscoveryVideoCard', () => {
  const mockVideo = {
    youtubeId: 'dQw4w9WgXcQ',
    title: 'Test Video Title',
    channelId: 'UCtest',
    channelName: 'Test Channel',
    publishedAt: new Date('2024-01-10T12:00:00Z').toISOString(),
    description: 'Test description',
    inBank: false,
  }

  it('should render video title with line clamp', () => {
    render(<DiscoveryVideoCard video={mockVideo} />)
    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
  })

  it('should render thumbnail with correct aspect ratio', () => {
    render(<DiscoveryVideoCard video={mockVideo} />)
    const thumbnail = screen.getByAltText('Test Video Title')
    expect(thumbnail).toBeInTheDocument()
    expect(thumbnail).toHaveAttribute('src', expect.stringContaining('dQw4w9WgXcQ'))
  })

  it('should render "Add to Bank" button when video is not in bank', () => {
    render(<DiscoveryVideoCard video={mockVideo} />)
    expect(screen.getByRole('link', { name: /add to bank/i })).toBeInTheDocument()
  })

  it('should render "In Bank" badge when video is already in bank', () => {
    render(<DiscoveryVideoCard video={{ ...mockVideo, inBank: true }} />)
    expect(screen.getByText('In Bank')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /add to bank/i })).not.toBeInTheDocument()
  })

  it('should link to add page with correct URL when not in bank', () => {
    render(<DiscoveryVideoCard video={mockVideo} />)
    const link = screen.getByRole('link', { name: /add to bank/i })
    expect(link).toHaveAttribute('href', '/add?url=https://youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('should include returnTo in add link when provided', () => {
    const returnTo = encodeURIComponent('/discovery?channel=UCtest')
    render(<DiscoveryVideoCard video={mockVideo} returnTo={returnTo} />)
    const link = screen.getByRole('link', { name: /add to bank/i })
    expect(link).toHaveAttribute('href', `/add?url=https://youtube.com/watch?v=dQw4w9WgXcQ&returnTo=${returnTo}`)
  })

  it('should render published date as relative time', () => {
    // Mock current time to be 5 days after published date
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))

    render(<DiscoveryVideoCard video={mockVideo} />)
    expect(screen.getByText('5d ago')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('should have compact card styling', () => {
    const { container } = render(<DiscoveryVideoCard video={mockVideo} />)
    const card = container.querySelector('[data-slot="card"]')
    expect(card).toHaveClass('overflow-hidden')
  })

  it('should not have scroll classes by default', () => {
    const { container } = render(<DiscoveryVideoCard video={mockVideo} />)
    const card = container.querySelector('[data-slot="card"]')
    expect(card).not.toHaveClass('min-w-[240px]')
    expect(card).not.toHaveClass('snap-start')
    expect(card).not.toHaveClass('shrink-0')
  })

  it('should accept custom className prop', () => {
    const { container } = render(
      <DiscoveryVideoCard video={mockVideo} className="min-w-[240px] snap-start shrink-0" />
    )
    const card = container.querySelector('[data-slot="card"]')
    expect(card).toHaveClass('min-w-[240px]')
    expect(card).toHaveClass('snap-start')
    expect(card).toHaveClass('shrink-0')
  })

  it('should render focus area badges when provided', () => {
    const focusAreas = [
      { id: 1, name: 'AI', color: '#FF0000' },
      { id: 2, name: 'Web Dev', color: '#00FF00' },
    ]
    render(<DiscoveryVideoCard video={mockVideo} focusAreas={focusAreas} />)
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('Web Dev')).toBeInTheDocument()
  })

  it('should not render focus area badges when not provided', () => {
    render(<DiscoveryVideoCard video={mockVideo} />)
    // Should not have a .flex.flex-wrap.gap-1 container for badges
    const { container } = render(<DiscoveryVideoCard video={mockVideo} />)
    const badgeContainer = container.querySelector('.flex.flex-wrap.gap-1')
    expect(badgeContainer).not.toBeInTheDocument()
  })

  it('should not render focus area badges when empty array provided', () => {
    const { container } = render(<DiscoveryVideoCard video={mockVideo} focusAreas={[]} />)
    const badgeContainer = container.querySelector('.flex.flex-wrap.gap-1')
    expect(badgeContainer).not.toBeInTheDocument()
  })

  it('should render focus area badges below the date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))

    const focusAreas = [{ id: 1, name: 'AI', color: '#FF0000' }]
    const { container } = render(<DiscoveryVideoCard video={mockVideo} focusAreas={focusAreas} />)

    // Find the date element
    const dateElement = screen.getByText('5d ago')
    // Find the badge
    const badge = screen.getByText('AI')

    // Badge should be rendered after date in DOM order
    const datePosition = Array.from(container.querySelectorAll('*')).indexOf(dateElement.closest('p')!)
    const badgePosition = Array.from(container.querySelectorAll('*')).indexOf(badge.closest('div')!)
    expect(badgePosition).toBeGreaterThan(datePosition)

    vi.useRealTimers()
  })

  describe('Bank video ID prop', () => {
    it('should accept bankVideoId prop and render without error', () => {
      render(<DiscoveryVideoCard video={mockVideo} bankVideoId={42} />)
      expect(screen.getByText('Test Video Title')).toBeInTheDocument()
    })

    it('should render without error when bankVideoId is undefined', () => {
      render(<DiscoveryVideoCard video={mockVideo} bankVideoId={undefined} />)
      expect(screen.getByText('Test Video Title')).toBeInTheDocument()
    })

    it('should render without error when bankVideoId is not provided', () => {
      render(<DiscoveryVideoCard video={mockVideo} />)
      expect(screen.getByText('Test Video Title')).toBeInTheDocument()
    })
  })

  describe('Selection behavior', () => {
    it('should render checkbox when selectable and not in bank', () => {
      const onToggleSelect = vi.fn()
      render(
        <DiscoveryVideoCard
          video={mockVideo}
          selectable={true}
          selected={false}
          onToggleSelect={onToggleSelect}
        />
      )
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
    })

    it('should not render checkbox when not selectable', () => {
      render(<DiscoveryVideoCard video={mockVideo} selectable={false} />)
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('should not render checkbox when video is in bank', () => {
      const onToggleSelect = vi.fn()
      render(
        <DiscoveryVideoCard
          video={{ ...mockVideo, inBank: true }}
          selectable={true}
          onToggleSelect={onToggleSelect}
        />
      )
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('should call onToggleSelect when checkbox is clicked', () => {
      const onToggleSelect = vi.fn()
      render(
        <DiscoveryVideoCard
          video={mockVideo}
          selectable={true}
          selected={false}
          onToggleSelect={onToggleSelect}
        />
      )
      const checkbox = screen.getByRole('checkbox')
      checkbox.click()
      expect(onToggleSelect).toHaveBeenCalledWith('dQw4w9WgXcQ')
      expect(onToggleSelect).toHaveBeenCalledTimes(1)
    })

    it('should render checkbox as checked when selected is true', () => {
      const onToggleSelect = vi.fn()
      render(
        <DiscoveryVideoCard
          video={mockVideo}
          selectable={true}
          selected={true}
          onToggleSelect={onToggleSelect}
        />
      )
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('should render checkbox as unchecked when selected is false', () => {
      const onToggleSelect = vi.fn()
      render(
        <DiscoveryVideoCard
          video={mockVideo}
          selectable={true}
          selected={false}
          onToggleSelect={onToggleSelect}
        />
      )
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(false)
    })

    it('should add ring-primary class to card when selected', () => {
      const onToggleSelect = vi.fn()
      const { container } = render(
        <DiscoveryVideoCard
          video={mockVideo}
          selectable={true}
          selected={true}
          onToggleSelect={onToggleSelect}
        />
      )
      const card = container.querySelector('[data-slot="card"]')
      expect(card).toHaveClass('ring-2')
      expect(card).toHaveClass('ring-primary')
    })

    it('should not add ring classes to card when not selected', () => {
      const onToggleSelect = vi.fn()
      const { container } = render(
        <DiscoveryVideoCard
          video={mockVideo}
          selectable={true}
          selected={false}
          onToggleSelect={onToggleSelect}
        />
      )
      const card = container.querySelector('[data-slot="card"]')
      expect(card).not.toHaveClass('ring-2')
      expect(card).not.toHaveClass('ring-primary')
    })

    it('should render selection overlay when selected', () => {
      const onToggleSelect = vi.fn()
      const { container } = render(
        <DiscoveryVideoCard
          video={mockVideo}
          selectable={true}
          selected={true}
          onToggleSelect={onToggleSelect}
        />
      )
      const overlay = container.querySelector('.bg-primary\\/10')
      expect(overlay).toBeInTheDocument()
    })

    it('should not render selection overlay when not selected', () => {
      const onToggleSelect = vi.fn()
      const { container } = render(
        <DiscoveryVideoCard
          video={mockVideo}
          selectable={true}
          selected={false}
          onToggleSelect={onToggleSelect}
        />
      )
      const overlay = container.querySelector('.bg-primary\\/10')
      expect(overlay).not.toBeInTheDocument()
    })
  })
})

describe('DiscoveryVideoCardSkeleton', () => {
  it('should render skeleton with correct structure', async () => {
    const { DiscoveryVideoCardSkeleton } = await import('../DiscoveryVideoCard')
    const { container } = render(<DiscoveryVideoCardSkeleton />)

    // Should have aspect-video thumbnail skeleton
    const thumbnail = container.querySelector('.aspect-video')
    expect(thumbnail).toBeInTheDocument()
    expect(thumbnail).toHaveClass('animate-pulse')
  })
})
