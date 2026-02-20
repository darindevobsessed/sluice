import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KnowledgeBankPageSkeleton } from '../KnowledgeBankPageSkeleton'

// Mock next/image defensively since VideoCardSkeleton imports from VideoCard.tsx
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

// Mock next/link defensively
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('KnowledgeBankPageSkeleton', () => {
  it('renders the full-page skeleton container', () => {
    render(<KnowledgeBankPageSkeleton />)

    const skeleton = screen.getByTestId('knowledge-bank-skeleton')
    expect(skeleton).toBeInTheDocument()
  })

  it('includes StatsHeaderSkeleton', () => {
    render(<KnowledgeBankPageSkeleton />)

    const statsHeaderSkeleton = screen.getByTestId('stats-header-skeleton')
    expect(statsHeaderSkeleton).toBeInTheDocument()
  })

  it('includes PersonaStatusSkeleton', () => {
    render(<KnowledgeBankPageSkeleton />)

    const personaStatusSkeleton = screen.getByTestId('persona-status-skeleton')
    expect(personaStatusSkeleton).toBeInTheDocument()
  })

  it('includes search bar skeleton', () => {
    const { container } = render(<KnowledgeBankPageSkeleton />)

    // Look for the search bar skeleton: h-10, animate-pulse, rounded-md elements in mb-8 wrapper
    const searchSkeleton = container.querySelector('.h-10.animate-pulse.rounded-md')
    expect(searchSkeleton).toBeInTheDocument()
  })

  it('includes 8 video card skeletons', () => {
    render(<KnowledgeBankPageSkeleton />)

    const videoCardSkeletons = screen.getAllByTestId('video-card-skeleton')
    expect(videoCardSkeletons).toHaveLength(8)
  })

  it('uses correct grid layout classes matching VideoGrid', () => {
    const { container } = render(<KnowledgeBankPageSkeleton />)

    // Select the video grid specifically (the one containing VideoCardSkeleton elements)
    // querySelector('.grid') would match StatsHeaderSkeleton first, so we use querySelectorAll
    const grids = container.querySelectorAll('.grid')
    const videoGrid = Array.from(grids).find(
      (el) => el.querySelector('[data-testid="video-card-skeleton"]') !== null,
    )
    expect(videoGrid).toBeDefined()
    expect(videoGrid).toHaveClass('grid-cols-1')
    expect(videoGrid).toHaveClass('sm:grid-cols-2')
    expect(videoGrid).toHaveClass('md:grid-cols-3')
    expect(videoGrid).toHaveClass('lg:grid-cols-4')
    expect(videoGrid).toHaveClass('xl:grid-cols-5')
    expect(videoGrid).toHaveClass('gap-6')
  })

  it('has correct outer padding classes', () => {
    const { container } = render(<KnowledgeBankPageSkeleton />)

    const skeleton = screen.getByTestId('knowledge-bank-skeleton')
    expect(skeleton).toHaveClass('p-4')
    expect(skeleton).toHaveClass('sm:p-6')
  })
})
