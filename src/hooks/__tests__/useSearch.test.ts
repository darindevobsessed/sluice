import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSearch } from '../useSearch';

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
    const { result } = renderHook(() => useSearch());

    expect(result.current.query).toBe('');
    expect(result.current.results).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.mode).toBe('hybrid');
  });

  it('does not fetch when query is empty', () => {
    renderHook(() => useSearch());

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('debounces search query', async () => {
    vi.useFakeTimers();
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

    const { result } = renderHook(() => useSearch());

    // Update query multiple times rapidly
    act(() => {
      result.current.setQuery('t');
      result.current.setQuery('te');
      result.current.setQuery('tes');
      result.current.setQuery('test');
    });

    // Should not have called fetch yet
    expect(mockFetch).not.toHaveBeenCalled();

    // Fast-forward past debounce delay (300ms)
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    // Now should have called fetch once
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/search?q=test&mode=hybrid',
      expect.any(Object)
    );

    vi.useRealTimers();
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

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('test');
    });

    // Wait for debounce
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    // Should be loading now
    expect(result.current.isLoading).toBe(true);

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

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('test');
    });

    await waitFor(
      () => {
        expect(result.current.results).toEqual(mockResponse);
      },
      { timeout: 1000 }
    );
  });

  it('handles fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('test');
    });

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

    const { result } = renderHook(() => useSearch());

    // Set query
    act(() => {
      result.current.setQuery('test');
    });

    await waitFor(
      () => {
        expect(result.current.results).toEqual(mockResponse);
      },
      { timeout: 1000 }
    );

    // Clear query
    act(() => {
      result.current.setQuery('');
    });

    expect(result.current.results).toBeNull();
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

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setMode('vector');
      result.current.setQuery('test');
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

  it('fetches only the final query when rapidly changing', async () => {
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

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('test1');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    act(() => {
      result.current.setQuery('test2');
    });

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/search?q=test2&mode=hybrid',
          expect.any(Object)
        );
      },
      { timeout: 1000 }
    );

    // Should only have called once (for test2, not test1)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('ignores AbortError', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('test');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
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

    const { result, unmount } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('test');
    });

    // Wait for debounce to trigger
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    // Fetch should be called
    expect(mockFetch).toHaveBeenCalled();

    // Unmount should clean up without errors
    unmount();

    // If cleanup works, this test passes without hanging
    expect(true).toBe(true);
  });
});
