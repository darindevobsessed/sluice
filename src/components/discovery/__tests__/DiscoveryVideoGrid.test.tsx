import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscoveryVideoGrid } from '../DiscoveryVideoGrid'
import type { DiscoveryVideo } from '../DiscoveryVideoCard'

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const createMockVideo = (overrides: Partial<DiscoveryVideo> = {}): DiscoveryVideo => ({
  youtubeId: 'abc123',
  title: 'Test Video',
  channelId: 'UCtest',
  channelName: 'Test Channel',
  publishedAt: new Date('2024-01-10T12:00:00Z').toISOString(),
  description: 'Test description',
  inBank: false,
  ...overrides,
})

const createMockVideos = (count: number): DiscoveryVideo[] => {
  return Array.from({ length: count }, (_, i) => createMockVideo({
    youtubeId: `video${i}`,
    title: `Video ${i}`,
    publishedAt: new Date(Date.now() - i * 86400000).toISOString(), // Descending dates
  }))
}

describe('DiscoveryVideoGrid', () => {
  beforeEach(() => {
    // Mock scrollTo
    window.scrollTo = vi.fn()
  })

  it('should render videos in responsive grid layout', () => {
    const videos = createMockVideos(10)
    const { container } = render(<DiscoveryVideoGrid videos={videos} />)

    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
    expect(grid).toHaveClass('grid-cols-1')
    expect(grid).toHaveClass('sm:grid-cols-2')
    expect(grid).toHaveClass('md:grid-cols-3')
    expect(grid).toHaveClass('lg:grid-cols-4')
    expect(grid).toHaveClass('xl:grid-cols-5')
    expect(grid).toHaveClass('gap-6')
  })

  it('should render video cards for each video', () => {
    const videos = [
      createMockVideo({ title: 'First Video' }),
      createMockVideo({ title: 'Second Video' }),
      createMockVideo({ title: 'Third Video' }),
    ]
    render(<DiscoveryVideoGrid videos={videos} />)

    expect(screen.getByText('First Video')).toBeInTheDocument()
    expect(screen.getByText('Second Video')).toBeInTheDocument()
    expect(screen.getByText('Third Video')).toBeInTheDocument()
  })

  it('should sort videos by publishedAt descending (newest first)', () => {
    const videos = [
      createMockVideo({ title: 'Old Video', publishedAt: '2024-01-01T00:00:00Z' }),
      createMockVideo({ title: 'New Video', publishedAt: '2024-01-15T00:00:00Z' }),
      createMockVideo({ title: 'Middle Video', publishedAt: '2024-01-10T00:00:00Z' }),
    ]
    render(<DiscoveryVideoGrid videos={videos} />)

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles[0]).toBe('New Video')
    expect(titles[1]).toBe('Middle Video')
    expect(titles[2]).toBe('Old Video')
  })

  it('should display only 24 videos per page', () => {
    const videos = createMockVideos(30)
    render(<DiscoveryVideoGrid videos={videos} />)

    // Should render 24 cards
    const cards = screen.getAllByRole('heading', { level: 3 })
    expect(cards).toHaveLength(24)
  })

  it('should show pagination when totalPages > 1', () => {
    const videos = createMockVideos(30) // 2 pages
    render(<DiscoveryVideoGrid videos={videos} />)

    // Pagination should be present
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument()
  })

  it('should not show pagination when totalPages <= 1', () => {
    const videos = createMockVideos(20) // 1 page (20 < 24)
    render(<DiscoveryVideoGrid videos={videos} />)

    // Pagination should not be present
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument()
  })

  it('should navigate to next page and show correct videos', async () => {
    const user = userEvent.setup()
    const videos = createMockVideos(30) // 2 pages
    render(<DiscoveryVideoGrid videos={videos} />)

    // First page should show Video 0-23
    expect(screen.getByText('Video 0')).toBeInTheDocument()
    expect(screen.queryByText('Video 24')).not.toBeInTheDocument()

    // Click next page
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Second page should show Video 24-29
    expect(screen.queryByText('Video 0')).not.toBeInTheDocument()
    expect(screen.getByText('Video 24')).toBeInTheDocument()
    expect(screen.getByText('Video 29')).toBeInTheDocument()
  })

  it('should scroll to top on page change', async () => {
    const user = userEvent.setup()
    const videos = createMockVideos(30)
    const { container } = render(<DiscoveryVideoGrid videos={videos} />)

    // Get the grid element
    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()

    // Click next page
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // scrollIntoView should have been called on the grid
    expect(window.scrollTo).toHaveBeenCalled()
  })

  it('should render loading state with 24 skeletons', () => {
    render(<DiscoveryVideoGrid videos={[]} isLoading={true} />)

    // Should render 24 skeleton cards
    const skeletons = screen.getAllByTestId('discovery-video-card-skeleton')
    expect(skeletons).toHaveLength(24)
  })

  it('should render loading state in grid layout', () => {
    const { container } = render(<DiscoveryVideoGrid videos={[]} isLoading={true} />)

    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
    expect(grid).toHaveClass('grid-cols-1')
    expect(grid).toHaveClass('sm:grid-cols-2')
    expect(grid).toHaveClass('md:grid-cols-3')
    expect(grid).toHaveClass('lg:grid-cols-4')
    expect(grid).toHaveClass('xl:grid-cols-5')
  })

  it('should render empty state when no videos and not loading', () => {
    render(<DiscoveryVideoGrid videos={[]} isLoading={false} />)

    expect(screen.getByText('Follow channels to discover videos')).toBeInTheDocument()
  })

  it('should not render pagination in empty state', () => {
    render(<DiscoveryVideoGrid videos={[]} isLoading={false} />)

    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument()
  })

  it('should pass focusAreas to video cards from focusAreaMap', () => {
    const videos = [
      createMockVideo({ youtubeId: 'video1', title: 'Video 1', inBank: true }),
      createMockVideo({ youtubeId: 'video2', title: 'Video 2', inBank: false }),
      createMockVideo({ youtubeId: 'video3', title: 'Video 3', inBank: true }),
    ]

    const focusAreaMap = {
      video1: [
        { id: 1, name: 'AI', color: '#FF0000' },
        { id: 2, name: 'Web Dev', color: '#00FF00' },
      ],
      video3: [
        { id: 3, name: 'DevOps', color: '#0000FF' },
      ],
    }

    render(<DiscoveryVideoGrid videos={videos} focusAreaMap={focusAreaMap} />)

    // Video 1 should have AI and Web Dev badges
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('Web Dev')).toBeInTheDocument()

    // Video 3 should have DevOps badge
    expect(screen.getByText('DevOps')).toBeInTheDocument()

    // Video 2 should have no badges
    const video2Card = screen.getByText('Video 2').closest('[data-slot="card"]')
    expect(video2Card).toBeInTheDocument()
    const badges = within(video2Card as HTMLElement).queryByText('AI')
    expect(badges).not.toBeInTheDocument()
  })

  it('should handle missing focusAreaMap gracefully', () => {
    const videos = [
      createMockVideo({ youtubeId: 'video1', title: 'Video 1', inBank: true }),
    ]

    render(<DiscoveryVideoGrid videos={videos} />)

    // Should render without errors
    expect(screen.getByText('Video 1')).toBeInTheDocument()
  })

  it('should handle focusAreaMap with no matching videos', () => {
    const videos = [
      createMockVideo({ youtubeId: 'video1', title: 'Video 1' }),
    ]

    const focusAreaMap = {
      nonExistentVideo: [{ id: 1, name: 'AI', color: '#FF0000' }],
    }

    render(<DiscoveryVideoGrid videos={videos} focusAreaMap={focusAreaMap} />)

    // Should render without errors, no badges
    expect(screen.getByText('Video 1')).toBeInTheDocument()
    expect(screen.queryByText('AI')).not.toBeInTheDocument()
  })

  it('should maintain current page state across pagination', async () => {
    const user = userEvent.setup()
    const videos = createMockVideos(50) // 3 pages
    render(<DiscoveryVideoGrid videos={videos} />)

    // Navigate to page 2
    const page2Button = screen.getByRole('button', { name: '2' })
    await user.click(page2Button)

    expect(screen.getByText('Video 24')).toBeInTheDocument()

    // Navigate to page 3
    const page3Button = screen.getByRole('button', { name: '3' })
    await user.click(page3Button)

    expect(screen.getByText('Video 48')).toBeInTheDocument()
  })

  it('should reset to page 1 when videos prop changes', async () => {
    const user = userEvent.setup()
    const videos1 = createMockVideos(30)
    const { rerender } = render(<DiscoveryVideoGrid videos={videos1} />)

    // Navigate to page 2
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Verify we're on page 2
    expect(screen.getByText('Video 24')).toBeInTheDocument()

    // Change videos to a completely new set with different IDs
    const videos2 = createMockVideos(30).map((v, i) => ({
      ...v,
      youtubeId: `newVideo${i}`,
      title: `New Video ${i}`
    }))
    rerender(<DiscoveryVideoGrid videos={videos2} />)

    // Should show first page of new videos (wait for effect to run)
    await screen.findByText('New Video 0')
    expect(screen.getByText('New Video 0')).toBeInTheDocument()
    expect(screen.queryByText('New Video 24')).not.toBeInTheDocument()
  })

  it('should calculate totalPages correctly', () => {
    const testCases = [
      { count: 0, expectedPages: 0 },
      { count: 1, expectedPages: 1 },
      { count: 24, expectedPages: 1 },
      { count: 25, expectedPages: 2 },
      { count: 48, expectedPages: 2 },
      { count: 49, expectedPages: 3 },
      { count: 100, expectedPages: 5 }, // 100 / 24 = 4.16... → 5 pages
    ]

    testCases.forEach(({ count, expectedPages }) => {
      const videos = createMockVideos(count)
      const { unmount } = render(<DiscoveryVideoGrid videos={videos} />)

      if (expectedPages > 1) {
        expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument()
      } else {
        expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument()
      }

      // Cleanup for next test
      unmount()
    })
  })
})
