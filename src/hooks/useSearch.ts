import { useState, useEffect, useRef } from 'react';
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
  degraded?: boolean;
}

interface UseSearchOptions {
  query: string;
  focusAreaId?: number | null;
}

/**
 * Hook for managing search state
 * Accepts query as a prop (debouncing handled by caller)
 */
export function useSearch(options: UseSearchOptions) {
  const { query, focusAreaId = null } = options;
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SearchMode>('hybrid');

  const abortControllerRef = useRef<AbortController | null>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Skip fetch if query is empty
    if (!trimmedQuery) {
      return;
    }

    // Fire search immediately (no debounce)
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const params = new URLSearchParams({
      q: trimmedQuery,
      mode,
    });
    if (focusAreaId !== null && focusAreaId !== undefined) {
      params.set('focusAreaId', String(focusAreaId));
    }

    const doSearch = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?${params}`, {
          signal: controller.signal,
        });
        const data: SearchResponse = await res.json();
        setResults(data);
        if (data.degraded) {
          const { toast } = await import('sonner');
          toast('Refresh for full results', {
            description: 'Search is running in limited mode',
            duration: 5000,
          });
        }
        setIsLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError('Search failed. Please try again.');
          setIsLoading(false);
        }
      }
    };

    doSearch();

    // Cleanup
    return () => {
      controller.abort();
    };
  }, [trimmedQuery, mode, focusAreaId]);

  // Derive empty-query state without setting state in effect
  const activeResults = trimmedQuery ? results : null;
  const activeIsLoading = trimmedQuery ? isLoading : false;
  const activeError = trimmedQuery ? error : null;

  return {
    results: activeResults,
    isLoading: activeIsLoading,
    error: activeError,
    mode,
    setMode,
  };
}
