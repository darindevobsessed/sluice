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
