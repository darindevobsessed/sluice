import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoCard, VideoCardSkeleton } from '../VideoCard';

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

const mockVideo = {
  id: 1,
  youtubeId: 'abc123',
  sourceType: 'youtube',
  title: 'React Tutorial for Beginners',
  channel: 'Fireship',
  thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
  duration: 3665, // 1:01:05
  transcript: 'Some transcript content',
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
  publishedAt: null,
};

describe('VideoCard', () => {
  it('renders video title', () => {
    render(<VideoCard video={mockVideo} />);
    expect(screen.getByText('React Tutorial for Beginners')).toBeInTheDocument();
  });

  it('renders channel name', () => {
    render(<VideoCard video={mockVideo} />);
    expect(screen.getByText('Fireship')).toBeInTheDocument();
  });

  it('renders formatted duration badge', () => {
    render(<VideoCard video={mockVideo} />);
    expect(screen.getByText('1:01:05')).toBeInTheDocument();
  });

  it('renders duration without hours when under 1 hour', () => {
    const shortVideo = { ...mockVideo, duration: 185 }; // 3:05
    render(<VideoCard video={shortVideo} />);
    expect(screen.getByText('3:05')).toBeInTheDocument();
  });

  it('handles null duration', () => {
    const noLengthVideo = { ...mockVideo, duration: null };
    render(<VideoCard video={noLengthVideo} />);
    // Should not crash, duration badge may not appear
    expect(screen.getByText('React Tutorial for Beginners')).toBeInTheDocument();
  });

  it('renders thumbnail image', () => {
    render(<VideoCard video={mockVideo} />);
    const img = screen.getByAltText('React Tutorial for Beginners');
    expect(img).toHaveAttribute('src', mockVideo.thumbnail);
  });

  it('links to video detail page', () => {
    render(<VideoCard video={mockVideo} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/videos/1');
  });

  it('renders date added', () => {
    render(<VideoCard video={mockVideo} />);
    // Should show formatted date - timezone independent check
    expect(screen.getByText(/Jan \d{1,2}, 2026/)).toBeInTheDocument();
  });

  it('handles null thumbnail with fallback message', () => {
    const noThumbnailVideo = { ...mockVideo, thumbnail: null };
    render(<VideoCard video={noThumbnailVideo} />);
    expect(screen.getByText('No thumbnail')).toBeInTheDocument();
    expect(screen.getByText('React Tutorial for Beginners')).toBeInTheDocument();
  });
});

describe('VideoCardSkeleton', () => {
  it('renders skeleton placeholder', () => {
    render(<VideoCardSkeleton />);
    // Should render without crashing
    expect(document.querySelector('[data-testid="video-card-skeleton"]')).toBeInTheDocument();
  });
});
