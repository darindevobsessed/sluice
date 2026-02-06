import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChunkResult } from '../ChunkResult';
import type { SearchResult } from '@/lib/search/types';

const mockChunk: SearchResult = {
  chunkId: 1,
  content:
    'This is a test chunk with some content that should be displayed in the component.',
  startTime: 42,
  endTime: 52,
  similarity: 0.85,
  videoId: 1,
  videoTitle: 'Test Video Title',
  channel: 'Test Channel',
  youtubeId: 'abc123',
  thumbnail: 'https://example.com/thumb.jpg',
};

describe('ChunkResult', () => {
  it('renders chunk content', () => {
    render(<ChunkResult chunk={mockChunk} />);

    expect(screen.getByText(/This is a test chunk/)).toBeInTheDocument();
  });

  it('renders video title and channel as link', () => {
    render(<ChunkResult chunk={mockChunk} />);

    const videoLink = screen.getByRole('link', { name: /Test Video Title/ });
    expect(videoLink).toBeInTheDocument();
    expect(videoLink).toHaveAttribute('href', `/videos/${mockChunk.videoId}`);

    expect(screen.getByText('Test Channel')).toBeInTheDocument();
  });

  it('renders timestamp as clickable link', () => {
    render(<ChunkResult chunk={mockChunk} />);

    const timestampLink = screen.getByRole('link', { name: /00:42/ });
    expect(timestampLink).toBeInTheDocument();
    expect(timestampLink).toHaveAttribute(
      'href',
      `/videos/${mockChunk.videoId}?t=42`
    );
  });

  it('renders similarity score as percentage', () => {
    render(<ChunkResult chunk={mockChunk} />);

    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('truncates long content with show more button', () => {
    const longContent = 'a'.repeat(300);
    const longChunk = { ...mockChunk, content: longContent };

    render(<ChunkResult chunk={longChunk} />);

    // Should show truncated version initially
    const contentElement = screen.getByText(/aaa/, { exact: false });
    expect(contentElement.textContent?.length).toBeLessThan(300);

    // Should have show more button
    const showMoreButton = screen.getByRole('button', { name: /show more/i });
    expect(showMoreButton).toBeInTheDocument();
  });

  it('expands content when show more is clicked', () => {
    const longContent = 'a'.repeat(300);
    const longChunk = { ...mockChunk, content: longContent };

    render(<ChunkResult chunk={longChunk} />);

    const showMoreButton = screen.getByRole('button', { name: /show more/i });
    fireEvent.click(showMoreButton);

    // Should show full content
    const contentElement = screen.getByText(/aaa/, { exact: false });
    expect(contentElement.textContent?.length).toBeGreaterThanOrEqual(300);

    // Button should now say "show less"
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
  });

  it('handles null start time gracefully', () => {
    const chunkWithoutTime = { ...mockChunk, startTime: null };

    render(<ChunkResult chunk={chunkWithoutTime} />);

    // Should not crash, and should not show timestamp link
    expect(screen.queryByRole('link', { name: /00:/ })).not.toBeInTheDocument();
  });

  it('formats timestamp correctly for different times', () => {
    const cases = [
      { startTime: 5, expected: '00:05' },
      { startTime: 65, expected: '01:05' },
      { startTime: 3665, expected: '1:01:05' },
    ];

    cases.forEach(({ startTime, expected }) => {
      const chunk = { ...mockChunk, startTime };
      const { unmount } = render(<ChunkResult chunk={chunk} />);

      expect(screen.getByText(expected)).toBeInTheDocument();

      unmount();
    });
  });

  it('highlights matching terms if provided', () => {
    const highlightTerms = ['test', 'chunk'];

    render(<ChunkResult chunk={mockChunk} highlightTerms={highlightTerms} />);

    // Check that highlighted terms exist
    const highlighted = screen.getAllByRole('mark', { hidden: true });
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it('renders similarity score as visual bar', () => {
    render(<ChunkResult chunk={mockChunk} />);

    // Check for progress bar or visual indicator
    const progressBar = screen.getByRole('progressbar', { hidden: true });
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '85');
  });

  it('applies custom className', () => {
    const { container } = render(
      <ChunkResult chunk={mockChunk} className="custom-class" />
    );

    const chunkElement = container.firstChild as HTMLElement;
    expect(chunkElement).toHaveClass('custom-class');
  });
});
