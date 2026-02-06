import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEmbedding } from '../useEmbedding';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts in idle state', () => {
      const { result } = renderHook(() => useEmbedding(1));

      expect(result.current.state).toBe('idle');
      expect(result.current.hasEmbeddings).toBe(false);
      expect(result.current.chunkCount).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toEqual({ current: 0, total: 0 });
    });
  });

  describe('checkStatus', () => {
    it('updates hasEmbeddings to true when embeddings exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hasEmbeddings: true,
          chunkCount: 5,
        }),
      });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.hasEmbeddings).toBe(true);
        expect(result.current.chunkCount).toBe(5);
      });
    });

    it('updates hasEmbeddings to false when no embeddings exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hasEmbeddings: false,
          chunkCount: 0,
        }),
      });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.hasEmbeddings).toBe(false);
        expect(result.current.chunkCount).toBe(0);
      });
    });

    it('handles check status errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.hasEmbeddings).toBe(false);
      });
    });
  });

  describe('embed', () => {
    it('transitions through loading state', async () => {
      // Slow down the POST request to test loading state
      let resolveEmbed: (value: unknown) => void;
      const embedPromise = new Promise((resolve) => {
        resolveEmbed = resolve;
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            hasEmbeddings: false,
            chunkCount: 0,
          }),
        })
        .mockImplementationOnce(async () => {
          await embedPromise;
          return {
            ok: true,
            json: async () => ({
              success: true,
              chunkCount: 3,
              durationMs: 500,
            }),
          };
        });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.hasEmbeddings).toBe(false);
      });

      // Trigger embed
      result.current.embed();

      // Should transition to loading
      await waitFor(() => {
        expect(result.current.state).toBe('loading');
      });

      // Resolve the embed
      resolveEmbed!({});

      // Should transition to success
      await waitFor(() => {
        expect(result.current.state).toBe('success');
        expect(result.current.hasEmbeddings).toBe(true);
        expect(result.current.chunkCount).toBe(3);
      });
    });

    it('updates state to success after successful embedding', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            hasEmbeddings: false,
            chunkCount: 0,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            chunkCount: 5,
            durationMs: 1000,
          }),
        });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.state).toBe('idle');
      });

      result.current.embed();

      await waitFor(() => {
        expect(result.current.state).toBe('success');
        expect(result.current.chunkCount).toBe(5);
        expect(result.current.hasEmbeddings).toBe(true);
      });
    });

    it('handles embedding errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            hasEmbeddings: false,
            chunkCount: 0,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            error: 'Embedding failed',
          }),
        });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.state).toBe('idle');
      });

      result.current.embed();

      await waitFor(() => {
        expect(result.current.state).toBe('error');
        expect(result.current.error).toBe('Embedding failed');
      });
    });

    it('handles network errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            hasEmbeddings: false,
            chunkCount: 0,
          }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.state).toBe('idle');
      });

      result.current.embed();

      await waitFor(() => {
        expect(result.current.state).toBe('error');
        expect(result.current.error).toBe('Network error');
      });
    });

    it('does nothing if already loading', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          hasEmbeddings: false,
          chunkCount: 0,
        }),
      });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.state).toBe('idle');
      });

      // Mock a long-running embed
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ success: true, chunkCount: 3 }),
                }),
              1000
            )
          )
      );

      result.current.embed();

      await waitFor(() => {
        expect(result.current.state).toBe('loading');
      });

      // Try to embed again while loading
      const callCount = mockFetch.mock.calls.length;
      result.current.embed();

      // Should not trigger another fetch
      expect(mockFetch.mock.calls.length).toBe(callCount);
    });

    it('does nothing if already embedded', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hasEmbeddings: true,
          chunkCount: 5,
        }),
      });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.hasEmbeddings).toBe(true);
      });

      // Clear mock to check if embed() calls it
      mockFetch.mockClear();

      result.current.embed();

      // Should not call fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('progress tracking', () => {
    it('initializes progress with zero values', () => {
      const { result } = renderHook(() => useEmbedding(1));

      expect(result.current.progress).toEqual({ current: 0, total: 0 });
    });
  });
});
