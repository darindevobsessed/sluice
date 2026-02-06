import { useState, useEffect, useCallback } from 'react';

type EmbedState = 'idle' | 'loading' | 'success' | 'error';

interface Progress {
  current: number;
  total: number;
}

interface UseEmbeddingReturn {
  state: EmbedState;
  hasEmbeddings: boolean;
  chunkCount: number;
  error: string | null;
  progress: Progress;
  embed: () => void;
}

/**
 * Hook for managing video embedding state and operations
 */
export function useEmbedding(videoId: number): UseEmbeddingReturn {
  const [state, setState] = useState<EmbedState>('idle');
  const [hasEmbeddings, setHasEmbeddings] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0 });

  // Check status on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch(`/api/videos/${videoId}/embed/status`);
        if (response.ok) {
          const data = await response.json();
          setHasEmbeddings(data.hasEmbeddings ?? false);
          setChunkCount(data.chunkCount ?? 0);
        }
      } catch (err) {
        // Silently fail status check
        console.error('Failed to check embedding status:', err);
      }
    }

    checkStatus();
  }, [videoId]);

  // Generate embeddings
  const embed = useCallback(async () => {
    // Don't start if already loading or already embedded
    if (state === 'loading' || hasEmbeddings) {
      return;
    }

    setState('loading');
    setError(null);
    setProgress({ current: 0, total: 0 });

    try {
      const response = await fetch(`/api/videos/${videoId}/embed`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setState('error');
        setError(data.error ?? 'Failed to generate embeddings');
        return;
      }

      if (data.success) {
        setState('success');
        setHasEmbeddings(true);
        setChunkCount(data.chunkCount ?? 0);
      } else {
        setState('error');
        setError(data.error ?? 'Failed to generate embeddings');
      }
    } catch (err) {
      setState('error');
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to generate embeddings';
      setError(errorMessage);
    }
  }, [videoId, state, hasEmbeddings]);

  return {
    state,
    hasEmbeddings,
    chunkCount,
    error,
    progress,
    embed,
  };
}
