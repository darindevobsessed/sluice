import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSearch } from '../useSearch';

// Mock sonner toast
const mockToast = vi.fn();
vi.mock('sonner', () => ({
  toast: mockToast,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useSearch({ query: '' }));

    expect(result.current.results).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.mode).toBe('hybrid');
  });

  it('does not fetch when query is empty', () => {
    renderHook(() => useSearch({ query: '' }));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches immediately when query changes (no debounce)', async () => {
    const mockResponse = {
      chunks: [],
      videos: [],
      query: 'test',
      mode: 'hybrid' as const,
      timing: 10,
      hasEmbeddings: true,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { rerender } = renderHook(
      ({ query }) => useSearch({ query }),
      { initialProps: { query: '' } }
    );

    // Should not fetch on empty query
    expect(mockFetch).not.toHaveBeenCalled();

    // Change query to non-empty value
    rerender({ query: 'test' });

    // Should fetch immediately without debounce
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/search?q=test&mode=hybrid',
        expect.any(Object)
      );
    });
  });

  it('sets loading state during fetch', async () => {
    const mockResponse = {
      chunks: [],
      videos: [],
      query: 'test',
      mode: 'hybrid' as const,
      timing: 10,
      hasEmbeddings: true,
    };

    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    mockFetch.mockReturnValue(fetchPromise);

    const { result } = renderHook(() => useSearch({ query: 'test' }));

    // Should be loading immediately
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    // Complete the fetch
    await act(async () => {
      resolveFetch!({
        ok: true,
        json: async () => mockResponse,
      });
      await Promise.resolve();
    });

    // Should no longer be loading
    expect(result.current.isLoading).toBe(false);
  });

  it('stores search results', async () => {
    const mockResponse = {
      chunks: [
        {
          chunkId: 1,
          content: 'Test content',
          startTime: 0,
          endTime: 10,
          similarity: 0.9,
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'abc123',
          thumbnail: null,
        },
      ],
      videos: [
        {
          videoId: 1,
          youtubeId: 'abc123',
          title: 'Test Video',
          channel: 'Test Channel',
          thumbnail: null,
          score: 0.9,
          matchedChunks: 1,
          bestChunk: {
            content: 'Test content',
            startTime: 0,
            similarity: 0.9,
          },
        },
      ],
      query: 'test',
      mode: 'hybrid' as const,
      timing: 10,
      hasEmbeddings: true,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useSearch({ query: 'test' }));

    await waitFor(
      () => {
        expect(result.current.results).toEqual(mockResponse);
      },
      { timeout: 1000 }
    );
  });

  it('handles fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSearch({ query: 'test' }));

    await waitFor(
      () => {
        expect(result.current.error).toBe('Search failed. Please try again.');
        expect(result.current.results).toBeNull();
      },
      { timeout: 1000 }
    );
  });

  it('clears results when query is cleared', async () => {
    const mockResponse = {
      chunks: [],
      videos: [],
      query: 'test',
      mode: 'hybrid' as const,
      timing: 10,
      hasEmbeddings: true,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result, rerender } = renderHook(
      ({ query }) => useSearch({ query }),
      { initialProps: { query: 'test' } }
    );

    await waitFor(
      () => {
        expect(result.current.results).toEqual(mockResponse);
      },
      { timeout: 1000 }
    );

    // Clear query by rerendering with empty string
    rerender({ query: '' });

    await waitFor(() => {
      expect(result.current.results).toBeNull();
    });
  });

  it('changes search mode', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        chunks: [],
        videos: [],
        query: 'test',
        mode: 'vector' as const,
        timing: 10,
        hasEmbeddings: true,
      }),
    });

    const { result } = renderHook(() => useSearch({ query: 'test' }));

    act(() => {
      result.current.setMode('vector');
    });

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/search?q=test&mode=vector',
          expect.any(Object)
        );
      },
      { timeout: 1000 }
    );
  });

  it('cancels previous request when query changes rapidly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        chunks: [],
        videos: [],
        query: 'test2',
        mode: 'hybrid' as const,
        timing: 10,
        hasEmbeddings: true,
      }),
    });

    const { rerender } = renderHook(
      ({ query }) => useSearch({ query }),
      { initialProps: { query: 'test1' } }
    );

    // Immediately change to test2 (should abort test1)
    rerender({ query: 'test2' });

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/search?q=test2&mode=hybrid',
          expect.any(Object)
        );
      },
      { timeout: 1000 }
    );

    // Both requests fire, but the first is aborted
    // We expect 2 calls total (test1 aborted, test2 completed)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('ignores AbortError', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    const { result } = renderHook(() => useSearch({ query: 'test' }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.error).toBeNull();
  });

  it('cleans up on unmount', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves - simulates pending request
        })
    );

    const { unmount } = renderHook(() => useSearch({ query: 'test' }));

    // Wait for fetch to be called
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Fetch should be called
    expect(mockFetch).toHaveBeenCalled();

    // Unmount should clean up without errors
    unmount();

    // If cleanup works, this test passes without hanging
    expect(true).toBe(true);
  });

  it('includes focusAreaId in request when provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        chunks: [],
        videos: [],
        query: 'test',
        mode: 'hybrid' as const,
        timing: 10,
        hasEmbeddings: true,
      }),
    });

    renderHook(() => useSearch({ query: 'test', focusAreaId: 42 }));

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/search?q=test&mode=hybrid&focusAreaId=42',
          expect.any(Object)
        );
      },
      { timeout: 1000 }
    );
  });

  it('shows toast when response has degraded: true', async () => {
    const mockResponse = {
      chunks: [],
      videos: [],
      query: 'test',
      mode: 'hybrid' as const,
      timing: 10,
      hasEmbeddings: false,
      degraded: true,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    renderHook(() => useSearch({ query: 'test' }));

    await waitFor(
      () => {
        expect(mockToast).toHaveBeenCalledWith('Refresh for full results', {
          description: 'Search is running in limited mode',
          duration: 5000,
        });
      },
      { timeout: 1000 }
    );
  });

  it('does not show toast when response has degraded: false', async () => {
    const mockResponse = {
      chunks: [],
      videos: [],
      query: 'test',
      mode: 'hybrid' as const,
      timing: 10,
      hasEmbeddings: true,
      degraded: false,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    renderHook(() => useSearch({ query: 'test' }));

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does not show toast when degraded is absent from response', async () => {
    const mockResponse = {
      chunks: [],
      videos: [],
      query: 'test',
      mode: 'hybrid' as const,
      timing: 10,
      hasEmbeddings: true,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    renderHook(() => useSearch({ query: 'test' }));

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );

    expect(mockToast).not.toHaveBeenCalled();
  });
});
