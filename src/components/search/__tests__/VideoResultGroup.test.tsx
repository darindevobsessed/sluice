import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoResultGroup } from '../VideoResultGroup';
import type { VideoResult } from '@/lib/search/aggregate';

const mockVideoResult: VideoResult = {
  videoId: 1,
  youtubeId: 'abc123',
  title: 'Test Video Title',
  channel: 'Test Channel',
  thumbnail: 'https://example.com/thumb.jpg',
  score: 0.85,
  matchedChunks: 3,
  bestChunk: {
    content: 'This is the best matching chunk from the video',
    startTime: 42,
    similarity: 0.9,
  },
};

describe('VideoResultGroup', () => {
  it('renders video title and channel', () => {
    render(<VideoResultGroup video={mockVideoResult} />);

    expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    expect(screen.getByText('Test Channel')).toBeInTheDocument();
  });

  it('renders matched chunk count badge', () => {
    render(<VideoResultGroup video={mockVideoResult} />);

    expect(screen.getByText('3 matches')).toBeInTheDocument();
  });

  it('renders best chunk preview', () => {
    render(<VideoResultGroup video={mockVideoResult} />);

    expect(
      screen.getByText(/This is the best matching chunk/)
    ).toBeInTheDocument();
  });

  it('renders similarity score', () => {
    render(<VideoResultGroup video={mockVideoResult} />);

    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('links to video detail page', () => {
    render(<VideoResultGroup video={mockVideoResult} />);

    const link = screen.getByRole('link', { name: /Test Video Title/ });
    expect(link).toHaveAttribute('href', '/videos/1');
  });

  it('renders thumbnail if available', () => {
    render(<VideoResultGroup video={mockVideoResult} />);

    const thumbnail = screen.getByRole('img', { name: /Test Video Title/ });
    expect(thumbnail).toBeInTheDocument();
    expect(thumbnail).toHaveAttribute('src');
  });

  it('handles missing thumbnail gracefully', () => {
    const videoWithoutThumb = { ...mockVideoResult, thumbnail: null };

    render(<VideoResultGroup video={videoWithoutThumb} />);

    // Should render placeholder or icon instead
    const placeholder = screen.queryByRole('img');
    expect(placeholder).not.toBeInTheDocument();
  });

  it('expands to show chunks when clicked', () => {
    const chunks = [
      {
        chunkId: 1,
        content: 'First chunk',
        startTime: 10,
        endTime: 20,
        similarity: 0.8,
        videoId: 1,
        videoTitle: 'Test Video Title',
        channel: 'Test Channel',
        youtubeId: 'abc123',
        thumbnail: null,
      },
      {
        chunkId: 2,
        content: 'Second chunk',
        startTime: 30,
        endTime: 40,
        similarity: 0.7,
        videoId: 1,
        videoTitle: 'Test Video Title',
        channel: 'Test Channel',
        youtubeId: 'abc123',
        thumbnail: null,
      },
    ];

    render(<VideoResultGroup video={mockVideoResult} chunks={chunks} />);

    // Chunks should not be visible initially
    expect(screen.queryByText('First chunk')).not.toBeInTheDocument();

    // Click expand button
    const expandButton = screen.getByRole('button', { name: /expand/i });
    fireEvent.click(expandButton);

    // Chunks should now be visible
    expect(screen.getByText('First chunk')).toBeInTheDocument();
    expect(screen.getByText('Second chunk')).toBeInTheDocument();
  });

  it('collapses chunks when clicked again', () => {
    const chunks = [
      {
        chunkId: 1,
        content: 'First chunk',
        startTime: 10,
        endTime: 20,
        similarity: 0.8,
        videoId: 1,
        videoTitle: 'Test Video Title',
        channel: 'Test Channel',
        youtubeId: 'abc123',
        thumbnail: null,
      },
    ];

    render(<VideoResultGroup video={mockVideoResult} chunks={chunks} />);

    const expandButton = screen.getByRole('button', { name: /expand/i });

    // Expand
    fireEvent.click(expandButton);
    expect(screen.getByText('First chunk')).toBeInTheDocument();

    // Collapse
    fireEvent.click(expandButton);
    expect(screen.queryByText('First chunk')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <VideoResultGroup video={mockVideoResult} className="custom-class" />
    );

    const videoElement = container.firstChild as HTMLElement;
    expect(videoElement).toHaveClass('custom-class');
  });
});
