import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoGrid } from '../VideoGrid';
import type { VideoListItem } from '@/lib/db/search';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockVideos: VideoListItem[] = [
  {
    id: 1,
    youtubeId: 'abc123',
    sourceType: 'youtube',
    title: 'React Tutorial',
    channel: 'Fireship',
    thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    duration: 600,
    description: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    publishedAt: null,
  },
  {
    id: 2,
    youtubeId: 'def456',
    sourceType: 'youtube',
    title: 'TypeScript Tips',
    channel: 'ThePrimeagen',
    thumbnail: 'https://i.ytimg.com/vi/def456/hqdefault.jpg',
    duration: 900,
    description: null,
    createdAt: new Date('2026-01-16'),
    updatedAt: new Date('2026-01-16'),
    publishedAt: null,
  },
];

describe('VideoGrid', () => {
  it('renders video cards when videos are provided', () => {
    render(<VideoGrid videos={mockVideos} isLoading={false} />);

    expect(screen.getByText('React Tutorial')).toBeInTheDocument();
    expect(screen.getByText('TypeScript Tips')).toBeInTheDocument();
    expect(screen.getByText('Fireship')).toBeInTheDocument();
    expect(screen.getByText('ThePrimeagen')).toBeInTheDocument();
  });

  it('renders loading skeletons when isLoading is true', () => {
    render(<VideoGrid videos={[]} isLoading={true} />);

    const skeletons = screen.getAllByTestId('video-card-skeleton');
    expect(skeletons).toHaveLength(10);
  });

  it('renders empty state when no videos and not loading', () => {
    render(<VideoGrid videos={[]} isLoading={false} />);

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search terms')).toBeInTheDocument();
  });

  it('renders correct grid layout classes', () => {
    const { container } = render(<VideoGrid videos={mockVideos} isLoading={false} />);

    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('sm:grid-cols-2');
    expect(grid).toHaveClass('md:grid-cols-3');
    expect(grid).toHaveClass('lg:grid-cols-4');
    expect(grid).toHaveClass('xl:grid-cols-5');
    expect(grid).toHaveClass('gap-6');
  });

  it('forwards insight summary to the matching video card', () => {
    const summaryMap: Record<number, string> = {
      1: 'React fundamentals explained clearly.',
    };
    render(<VideoGrid videos={mockVideos} isLoading={false} summaryMap={summaryMap} />);

    expect(screen.getByText('React fundamentals explained clearly.')).toBeInTheDocument();
  });

  it('does not render insight summary for videos not in summaryMap', () => {
    const summaryMap: Record<number, string> = {
      1: 'React fundamentals explained clearly.',
    };
    render(<VideoGrid videos={mockVideos} isLoading={false} summaryMap={summaryMap} />);

    // Video 2 (TypeScript Tips) has no summary — no second insight-summary element
    const summaries = document.querySelectorAll('[data-testid="insight-summary"]');
    expect(summaries).toHaveLength(1);
  });

  it('renders no insight summaries when summaryMap is empty', () => {
    render(<VideoGrid videos={mockVideos} isLoading={false} summaryMap={{}} />);

    expect(document.querySelectorAll('[data-testid="insight-summary"]')).toHaveLength(0);
  });

  it('renders no insight summaries when summaryMap is not provided', () => {
    render(<VideoGrid videos={mockVideos} isLoading={false} />);

    expect(document.querySelectorAll('[data-testid="insight-summary"]')).toHaveLength(0);
  });
});
