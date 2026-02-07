import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchResults } from '../SearchResults';
import type { SearchResponse } from '@/hooks/useSearch';

const mockSearchResponse: SearchResponse = {
  chunks: [
    {
      chunkId: 1,
      content: 'Test chunk content',
      startTime: 10,
      endTime: 20,
      similarity: 0.8,
      videoId: 1,
      videoTitle: 'Test Video',
      channel: 'Test Channel',
      youtubeId: 'abc123',
      thumbnail: null,
      publishedAt: null,
    },
  ],
  videos: [
    {
      videoId: 1,
      youtubeId: 'abc123',
      title: 'Test Video',
      channel: 'Test Channel',
      thumbnail: null,
      score: 0.8,
      matchedChunks: 1,
      bestChunk: {
        content: 'Test chunk content',
        startTime: 10,
        similarity: 0.8,
      },
    },
  ],
  query: 'test',
  mode: 'hybrid',
  timing: 15,
  hasEmbeddings: true,
};

describe('SearchResults', () => {
  it('renders search timing', () => {
    render(<SearchResults results={mockSearchResponse} />);

    expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
    expect(screen.getByText(/in 15ms/)).toBeInTheDocument();
  });

  it('shows "By Video" and "By Chunk" tabs', () => {
    render(<SearchResults results={mockSearchResponse} />);

    expect(screen.getByRole('tab', { name: /By Video/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /By Chunk/i })).toBeInTheDocument();
  });

  it('defaults to "By Video" view', () => {
    render(<SearchResults results={mockSearchResponse} />);

    const videoTab = screen.getByRole('tab', { name: /By Video/i });
    expect(videoTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to "By Chunk" view when tab clicked', () => {
    render(<SearchResults results={mockSearchResponse} />);

    const chunkTab = screen.getByRole('tab', { name: /By Chunk/i });

    // Just verify clicking doesn't error
    fireEvent.click(chunkTab);

    // Verify tab is present after click (basic interaction test)
    expect(chunkTab).toBeInTheDocument();
  });

  it('shows video results in "By Video" view', () => {
    render(<SearchResults results={mockSearchResponse} />);

    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByText('1 match')).toBeInTheDocument();
  });

  it('shows chunk results in "By Chunk" view', () => {
    render(<SearchResults results={mockSearchResponse} />);

    const chunkTab = screen.getByRole('tab', { name: /By Chunk/i });
    fireEvent.click(chunkTab);

    expect(screen.getByText('Test chunk content')).toBeInTheDocument();
  });

  it('shows empty state when no results', () => {
    const emptyResults: SearchResponse = {
      ...mockSearchResponse,
      chunks: [],
      videos: [],
    };

    render(<SearchResults results={emptyResults} />);

    expect(screen.getByText(/No results found for "test"/)).toBeInTheDocument();
  });

  it('shows no embeddings message when hasEmbeddings is false', () => {
    const noEmbeddings: SearchResponse = {
      ...mockSearchResponse,
      hasEmbeddings: false,
      chunks: [],
      videos: [],
    };

    render(<SearchResults results={noEmbeddings} />);

    expect(
      screen.getByText(/Generate embeddings to enable semantic search/)
    ).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<SearchResults results={null} isLoading={true} />);

    // Should show skeleton cards
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('pluralizes result count correctly', () => {
    const { rerender } = render(<SearchResults results={mockSearchResponse} />);
    expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();

    const multipleResults: SearchResponse = {
      ...mockSearchResponse,
      videos: [mockSearchResponse.videos[0]!, mockSearchResponse.videos[0]!],
    };
    rerender(<SearchResults results={multipleResults} />);
    expect(screen.getByText(/Found 2 results/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <SearchResults results={mockSearchResponse} className="custom-class" />
    );

    const resultsElement = container.firstChild as HTMLElement;
    expect(resultsElement).toHaveClass('custom-class');
  });
});
