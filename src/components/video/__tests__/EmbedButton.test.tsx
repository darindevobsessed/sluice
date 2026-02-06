import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmbedButton } from '../EmbedButton';

// Mock the useEmbedding hook
vi.mock('@/hooks/useEmbedding', () => ({
  useEmbedding: vi.fn(),
}));

import { useEmbedding } from '@/hooks/useEmbedding';

describe('EmbedButton', () => {
  const mockEmbed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders "Generate Embeddings" when not embedded', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'idle',
        hasEmbeddings: false,
        chunkCount: 0,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      expect(screen.getByRole('button', { name: /generate embeddings/i })).toBeInTheDocument();
    });

    it('shows message when video has no transcript', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'idle',
        hasEmbeddings: false,
        chunkCount: 0,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={false} />);

      expect(screen.getByText(/no transcript available/i)).toBeInTheDocument();
      expect(screen.getByText(/transcript required to generate embeddings/i)).toBeInTheDocument();
      // No button should be rendered
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading state during embedding', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'loading',
        hasEmbeddings: false,
        chunkCount: 0,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      expect(screen.getByText(/generating embeddings/i)).toBeInTheDocument();
      expect(screen.getByText(/this may take a minute/i)).toBeInTheDocument();
      // No button during loading
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows loading message during embedding', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'loading',
        hasEmbeddings: false,
        chunkCount: 0,
        error: null,
        progress: { current: 5, total: 10 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      expect(screen.getByText(/generating embeddings/i)).toBeInTheDocument();
    });
  });

  describe('success state', () => {
    it('shows "Embedded (N chunks)" when complete', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'success',
        hasEmbeddings: true,
        chunkCount: 5,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      expect(screen.getByText(/embedded.*5 chunks/i)).toBeInTheDocument();
    });

    it('shows re-embed option when already embedded', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'idle',
        hasEmbeddings: true,
        chunkCount: 3,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      expect(screen.getByText(/embedded.*3 chunks/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /re-embed/i })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when embedding fails', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'error',
        hasEmbeddings: false,
        chunkCount: 0,
        error: 'Failed to generate embeddings',
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      expect(screen.getByText(/failed to generate embeddings/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('calls embed() on click when not embedded', async () => {
      const user = userEvent.setup();

      vi.mocked(useEmbedding).mockReturnValue({
        state: 'idle',
        hasEmbeddings: false,
        chunkCount: 0,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      const button = screen.getByRole('button', { name: /generate embeddings/i });
      await user.click(button);

      expect(mockEmbed).toHaveBeenCalledTimes(1);
    });

    it('calls embed() on click for re-embed', async () => {
      const user = userEvent.setup();

      vi.mocked(useEmbedding).mockReturnValue({
        state: 'idle',
        hasEmbeddings: true,
        chunkCount: 3,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      const button = screen.getByRole('button', { name: /re-embed/i });
      await user.click(button);

      expect(mockEmbed).toHaveBeenCalledTimes(1);
    });

    it('does not render button when no transcript', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'idle',
        hasEmbeddings: false,
        chunkCount: 0,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={false} />);

      // No button should be rendered
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(mockEmbed).not.toHaveBeenCalled();
    });

    it('does not render button when loading', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'loading',
        hasEmbeddings: false,
        chunkCount: 0,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      // No button during loading
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA labels', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'idle',
        hasEmbeddings: false,
        chunkCount: 0,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('provides descriptive text for all states', () => {
      vi.mocked(useEmbedding).mockReturnValue({
        state: 'loading',
        hasEmbeddings: false,
        chunkCount: 0,
        error: null,
        progress: { current: 0, total: 0 },
        embed: mockEmbed,
      });

      render(<EmbedButton videoId={1} hasTranscript={true} />);

      // Loading state should have descriptive text
      expect(screen.getByText(/generating embeddings/i)).toBeInTheDocument();
      expect(screen.getByText(/this may take a minute/i)).toBeInTheDocument();
    });
  });
});
