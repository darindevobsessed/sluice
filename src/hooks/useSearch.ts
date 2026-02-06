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
}

/**
 * Hook for managing search state with debounced queries
 */
export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SearchMode>('hybrid');

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear results if query is empty
    if (!query.trim()) {
      setResults(null);
      setError(null);
      return;
    }

    // Debounce search
    timeoutRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      fetch(`/api/search?q=${encodeURIComponent(query)}&mode=${mode}`, {
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
  }, [query, mode]);

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
