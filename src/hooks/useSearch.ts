import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchResult } from '@/lib/search/types';
import type { VideoResult } from '@/lib/search/aggregate';

/**
 * Search mode: vector, keyword, or hybrid (RRF)
 */
export type SearchMode = 'vector' | 'keyword' | 'hybrid';

/**
 * Search response format from /api/search
 */
export interface SearchResponse {
  chunks: SearchResult[];
  videos: VideoResult[];
  query: string;
  mode: SearchMode;
  timing: number;
  hasEmbeddings: boolean;
}

interface UseSearchOptions {
  focusAreaId?: number | null;
}

/**
 * Hook for managing search state with debounced queries
 */
export function useSearch(options: UseSearchOptions = {}) {
  const { focusAreaId = null } = options;
  const [query, setQueryRaw] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SearchMode>('hybrid');

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Wrap setQuery to clear results immediately when query is emptied
  const setQuery = useCallback((newQuery: string) => {
    setQueryRaw(newQuery);
    if (!newQuery.trim()) {
      setResults(null);
      setError(null);
    }
  }, []);

  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Nothing to fetch if query is empty
    if (!query.trim()) {
      return;
    }

    // Debounce search
    timeoutRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        q: query,
        mode,
      });
      if (focusAreaId !== null && focusAreaId !== undefined) {
        params.set('focusAreaId', String(focusAreaId));
      }

      fetch(`/api/search?${params}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data: SearchResponse) => {
          setResults(data);
          setIsLoading(false);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setError('Search failed. Please try again.');
            setIsLoading(false);
          }
        });
    }, 300);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, mode, focusAreaId]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    mode,
    setMode,
  };
}
