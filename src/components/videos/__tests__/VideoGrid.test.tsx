import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoGrid } from '../VideoGrid';
import type { Video } from '@/lib/db/schema';

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

const mockVideos: Video[] = [
  {
    id: 1,
    youtubeId: 'abc123',
    title: 'React Tutorial',
    channel: 'Fireship',
    thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    duration: 600,
    transcript: 'Transcript content',
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
  },
  {
    id: 2,
    youtubeId: 'def456',
    title: 'TypeScript Tips',
    channel: 'ThePrimeagen',
    thumbnail: 'https://i.ytimg.com/vi/def456/hqdefault.jpg',
    duration: 900,
    transcript: 'More transcript',
    createdAt: new Date('2026-01-16'),
    updatedAt: new Date('2026-01-16'),
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
    expect(skeletons).toHaveLength(8);
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
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(grid).toHaveClass('lg:grid-cols-3');
    expect(grid).toHaveClass('xl:grid-cols-4');
    expect(grid).toHaveClass('gap-6');
  });
});
