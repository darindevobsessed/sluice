import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEmbedding } from '../useEmbedding';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set a default fallback mock (tests can override with mockResolvedValueOnce)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        hasEmbeddings: false,
        chunkCount: 0,
      }),
    });
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

  describe('reEmbed', () => {
    it('calls embed endpoint even when hasEmbeddings is true', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            hasEmbeddings: true,
            chunkCount: 5,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            chunkCount: 7,
            durationMs: 500,
          }),
        });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.hasEmbeddings).toBe(true);
      });

      // Clear mock to verify reEmbed calls the endpoint
      mockFetch.mockClear();

      // Mock the re-embed request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          chunkCount: 7,
          durationMs: 500,
        }),
      });

      result.current.reEmbed();

      // Should call fetch despite hasEmbeddings being true
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/videos/1/embed', {
          method: 'POST',
        });
      });
    });

    it('updates state to success when re-embedding', async () => {
      // Clear and reset mock to ensure clean state
      mockFetch.mockReset();

      // Mock both status check and re-embed based on URL
      mockFetch.mockImplementation((url: string | Request | URL) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              hasEmbeddings: true,
              chunkCount: 5,
            }),
          } as Response)
        } else if (urlString.includes('/embed')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              chunkCount: 7,
              durationMs: 500,
            }),
          } as Response)
        }
        return Promise.reject(new Error(`Unexpected URL: ${urlString}`))
      });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.hasEmbeddings).toBe(true);
      });

      result.current.reEmbed();

      // Should transition to success with updated chunk count
      await waitFor(() => {
        expect(result.current.state).toBe('success');
        expect(result.current.hasEmbeddings).toBe(true);
        expect(result.current.chunkCount).toBe(7);
      });
    });

    it('handles re-embed errors', async () => {
      // Mock both status check and failed re-embed based on URL
      mockFetch.mockImplementation((url: string | Request | URL) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              hasEmbeddings: true,
              chunkCount: 5,
            }),
          } as Response)
        } else if (urlString.includes('/embed')) {
          return Promise.resolve({
            ok: false,
            json: async () => ({
              success: false,
              error: 'Re-embedding failed',
            }),
          } as Response)
        }
        return Promise.reject(new Error(`Unexpected URL: ${urlString}`))
      });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.hasEmbeddings).toBe(true);
      });

      result.current.reEmbed();

      await waitFor(() => {
        expect(result.current.state).toBe('error');
        expect(result.current.error).toBe('Re-embedding failed');
      });
    });

    it('does nothing if already loading', async () => {
      let embedCallCount = 0;

      // Mock both status check and long-running re-embed based on URL
      mockFetch.mockImplementation((url: string | Request | URL) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              hasEmbeddings: true,
              chunkCount: 5,
            }),
          } as Response)
        } else if (urlString.includes('/embed')) {
          embedCallCount++;
          // Return a promise that resolves after a delay
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ success: true, chunkCount: 7 }),
                } as Response),
              1000
            )
          )
        }
        return Promise.reject(new Error(`Unexpected URL: ${urlString}`))
      });

      const { result } = renderHook(() => useEmbedding(1));

      await waitFor(() => {
        expect(result.current.hasEmbeddings).toBe(true);
      });

      result.current.reEmbed();

      await waitFor(() => {
        expect(result.current.state).toBe('loading');
      });

      // Try to reEmbed again while loading
      result.current.reEmbed();

      // Should not trigger another embed call
      expect(embedCallCount).toBe(1);
    });
  });
});
